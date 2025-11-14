// app/api/inventory/cycle-counts/tasks/[id]/count/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { countedQuantity, notes, status } = await request.json();
    const { id } = await params;

    // Get the task with related data
    const task = await prisma.cycleCountTask.findUnique({
      where: { id },
      include: {
        productVariant: true,
        location: true,
        campaign: true,
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Calculate variance and determine status
    let finalStatus = status;
    let variance = null;
    let variancePercentage = null;
    let requiresReview = false;

    if (countedQuantity !== null && !status) {
      variance = countedQuantity - task.systemQuantity;

      if (task.systemQuantity > 0) {
        variancePercentage = (Math.abs(variance) / task.systemQuantity) * 100;
      } else if (countedQuantity > 0) {
        variancePercentage = 100; // New stock found
      }

      // Check tolerance
      const tolerance = task.tolerancePercentage?.toNumber() || 5.0;
      requiresReview =
        variancePercentage !== null && variancePercentage > tolerance;

      // ⭐ NEW: Always mark as COMPLETED or VARIANCE_REVIEW (not RECOUNT_REQUIRED)
      if (variance === 0) {
        finalStatus = "COMPLETED";
      } else if (requiresReview) {
        finalStatus = "VARIANCE_REVIEW"; // ← Changed from RECOUNT_REQUIRED
      } else {
        finalStatus = "COMPLETED"; // Within tolerance
      }
    } else if (status === "SKIPPED") {
      finalStatus = "SKIPPED";
    }

    // Start transaction for atomic updates
    const result = await prisma.$transaction(async (tx) => {
      // Update the task
      const updatedTask = await tx.cycleCountTask.update({
        where: { id },
        data: {
          countedQuantity: status === "SKIPPED" ? null : countedQuantity,
          variance,
          variancePercentage: variancePercentage ? variancePercentage : null,
          status: finalStatus,
          notes,
          completedAt: new Date(), // ⭐ Always set completion time
          requiresRecount: requiresReview, // Track if needs supervisor review
          assignedTo: session.user.id,
        },
      });

      // Create audit event
      await tx.cycleCountEvent.create({
        data: {
          taskId: id,
          eventType: status === "SKIPPED" ? "COUNT_SKIPPED" : "COUNT_RECORDED",
          userId: session.user.id,
          previousValue: task.systemQuantity,
          newValue: status === "SKIPPED" ? null : countedQuantity,
          notes,
          metadata: {
            variance,
            variancePercentage,
            requiresReview,
            tolerancePercentage: task.tolerancePercentage?.toNumber(),
          },
        },
      });

      // Always update lastCounted for completed counts
      if (task.productVariantId && status !== "SKIPPED") {
        await tx.inventory.updateMany({
          where: {
            productVariantId: task.productVariantId,
            locationId: task.locationId,
          },
          data: {
            lastCounted: new Date(),
          },
        });
      }

      // ⭐ NEW: Always apply inventory adjustment, even if variance needs review
      if (variance !== null && variance !== 0 && task.productVariantId) {
        // Create inventory transaction
        await tx.inventoryTransaction.create({
          data: {
            productVariantId: task.productVariantId,
            locationId: task.locationId,
            transactionType: "COUNT",
            quantityChange: variance,
            referenceId: id,
            referenceType: "CYCLE_COUNT",
            userId: session.user.id,
            notes: `Cycle count adjustment: ${
              notes || "Count variance recorded"
            }${requiresReview ? " (Pending supervisor review)" : ""}`,
          },
        });

        // Update inventory quantity
        await tx.inventory.upsert({
          where: {
            productVariantId_locationId: {
              productVariantId: task.productVariantId,
              locationId: task.locationId,
            },
          },
          update: {
            quantityOnHand: {
              increment: variance,
            },
            lastCounted: new Date(),
          },
          create: {
            productVariantId: task.productVariantId,
            locationId: task.locationId,
            quantityOnHand: countedQuantity || 0,
            lastCounted: new Date(),
          },
        });
      }

      // Update campaign statistics
      if (task.campaignId) {
        const campaignTasks = await tx.cycleCountTask.findMany({
          where: { campaignId: task.campaignId },
        });

        // ⭐ Include VARIANCE_REVIEW in completed count
        const completedCount = campaignTasks.filter((t) =>
          ["COMPLETED", "SKIPPED", "VARIANCE_REVIEW"].includes(
            t.id === id ? finalStatus : t.status
          )
        ).length;

        const varianceCount = campaignTasks.filter((t) => {
          if (t.id === id) {
            return variance !== null && variance !== 0;
          }
          return t.variance !== null && t.variance !== 0;
        }).length;

        await tx.cycleCountCampaign.update({
          where: { id: task.campaignId },
          data: {
            completedTasks: completedCount,
            variancesFound: varianceCount,
          },
        });
      }

      // ⭐ NEW: If variance needs review, create notification/flag for supervisor
      if (requiresReview && task.campaignId) {
        await tx.cycleCountEvent.create({
          data: {
            taskId: id,
            eventType: "VARIANCE_NOTED",
            userId: session.user.id,
            notes: `High variance detected: ${variance} units (${variancePercentage?.toFixed(
              1
            )}%) - Supervisor review requested`,
            metadata: {
              variance,
              variancePercentage,
              systemQuantity: task.systemQuantity,
              countedQuantity,
              requiresSupervisorReview: true,
            },
          },
        });

        // TODO: Send notification to supervisors
        // You can implement email/in-app notifications here
      }

      return updatedTask;
    });

    return NextResponse.json({
      success: true,
      task: result,
      variance,
      variancePercentage,
      requiresReview, // ← Changed from requiresRecount
      message: requiresReview
        ? "Count recorded - supervisor review requested due to high variance"
        : "Count recorded successfully",
    });
  } catch (error) {
    console.error("Error recording count:", error);
    return NextResponse.json(
      { error: "Failed to record count" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const taskId = params.id;

    const task = await prisma.cycleCountTask.findUnique({
      where: { id: taskId },
      include: {
        location: true,
        productVariant: {
          include: {
            product: true,
          },
        },
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        campaign: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        events: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error("Error fetching task:", error);
    return NextResponse.json(
      { error: "Failed to fetch task" },
      { status: 500 }
    );
  }
}
