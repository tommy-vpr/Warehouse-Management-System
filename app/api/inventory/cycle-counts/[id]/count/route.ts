// app/api/inventory/cycle-counts/[id]/count/route.ts - Real implementation
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

    const { itemId, countedQuantity, notes, status } = await request.json();
    const { id } = await params;

    // Get the task
    const task = await prisma.cycleCountTask.findUnique({
      where: { id },
      include: {
        productVariant: true,
        location: true,
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Calculate variance
    const variance =
      countedQuantity !== null ? countedQuantity - task.systemQuantity : null;
    const variancePercentage =
      variance !== null && task.systemQuantity > 0
        ? (Math.abs(variance) / task.systemQuantity) * 100
        : null;

    // Determine if recount is required based on tolerance
    const toleranceExceeded =
      variancePercentage !== null &&
      variancePercentage > (task.tolerancePercentage?.toNumber() || 5);

    // Update the task
    const updatedTask = await prisma.cycleCountTask.update({
      where: { id },
      data: {
        countedQuantity,
        variance,
        variancePercentage,
        status: status || (toleranceExceeded ? "VARIANCE_REVIEW" : "COMPLETED"),
        notes,
        completedAt: status === "COMPLETED" ? new Date() : null,
        requiresRecount: toleranceExceeded,
      },
    });

    // Create audit event
    await prisma.cycleCountEvent.create({
      data: {
        taskId: id,
        eventType: status === "SKIPPED" ? "COUNT_SKIPPED" : "COUNT_RECORDED",
        userId: session.user.id,
        previousValue: task.systemQuantity,
        newValue: countedQuantity,
        notes,
        metadata: {
          variance,
          variancePercentage,
          toleranceExceeded,
        },
      },
    });

    // If there's a significant variance, create inventory transaction
    if (variance !== null && variance !== 0 && !toleranceExceeded) {
      await prisma.inventoryTransaction.create({
        data: {
          productVariantId: task.productVariantId!,
          locationId: task.locationId,
          transactionType: "COUNT",
          quantityChange: variance,
          referenceId: id,
          referenceType: "CYCLE_COUNT",
          userId: session.user.id,
          notes: `Cycle count adjustment: ${notes || ""}`,
        },
      });

      // Update inventory
      await prisma.inventory.update({
        where: {
          productVariantId_locationId: {
            productVariantId: task.productVariantId!,
            locationId: task.locationId,
          },
        },
        data: {
          quantityOnHand: {
            increment: variance,
          },
          lastCounted: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      variance,
      requiresRecount: toleranceExceeded,
      task: updatedTask,
    });
  } catch (error) {
    console.error("Error recording count:", error);
    return NextResponse.json(
      { error: "Failed to record count" },
      { status: 500 }
    );
  }
}
