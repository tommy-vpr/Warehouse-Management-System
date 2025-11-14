import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notifyUser } from "@/lib/ably-server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, name: true },
    });

    if (!user) {
      return NextResponse.json({ error: "No user found" }, { status: 400 });
    }

    // if (!user || !["ADMIN", "MANAGER"].includes(user.role)) {
    //   return NextResponse.json(
    //     { error: "Insufficient permissions. Admin or Manager role required." },
    //     { status: 403 }
    //   );
    // }

    const { notes, assignTo } = await request.json();
    const { id } = await params;

    const task = await prisma.cycleCountTask.findUnique({
      where: { id },
      include: {
        campaign: true,
        location: true,
        productVariant: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (assignTo) {
      const assignee = await prisma.user.findUnique({
        where: { id: assignTo },
        select: { role: true, name: true, email: true },
      });

      if (!assignee) {
        return NextResponse.json(
          { error: "Assigned user not found" },
          { status: 404 }
        );
      }

      if (!["ADMIN", "MANAGER", "STAFF"].includes(assignee.role)) {
        return NextResponse.json(
          { error: "Assigned user does not have permission to count" },
          { status: 400 }
        );
      }
    }

    const updatedTask = await prisma.$transaction(async (tx) => {
      const updated = await tx.cycleCountTask.update({
        where: { id },
        data: {
          status: "RECOUNT_REQUIRED",
          requiresRecount: true,
          recountReason: notes || "Supervisor requested recount",
          assignedTo: assignTo || task.assignedTo,
          notes: notes
            ? `${task.notes || ""}\n[RECOUNT REQUESTED] ${notes}`.trim()
            : task.notes,
        },
        include: {
          assignedUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          campaign: true,
          location: true,
          productVariant: {
            include: {
              product: true,
            },
          },
        },
      });

      await tx.cycleCountEvent.create({
        data: {
          taskId: id,
          eventType: "RECOUNT_REQUESTED",
          userId: session.user.id,
          notes: `Recount requested: ${notes || "No reason provided"}`,
          metadata: {
            action: "RECOUNT_REQUESTED",
            previousStatus: task.status,
            assignedTo: assignTo,
            variance: task.variance,
          },
        },
      });

      // Create notification in database
      if (assignTo) {
        await tx.notification.create({
          data: {
            userId: assignTo,
            type: "RECOUNT_ASSIGNED",
            title: "Recount Task Assigned",
            message: `You've been assigned a recount for ${
              task.productVariant?.product.name || "location"
            } at ${task.location.name}`,
            link: `/dashboard/inventory/count/${task.campaignId}`,
            metadata: {
              taskId: task.id,
              campaignId: task.campaignId,
              variance: task.variance,
              requestedBy: user.name,
            },
          },
        });
      }

      return updated;
    });

    // Send Ably real-time notification
    if (assignTo) {
      await notifyUser(assignTo, {
        type: "RECOUNT_ASSIGNED",
        title: "Recount Task Assigned",
        message: `You've been assigned a recount for ${task.productVariant?.product.name}`,
        taskId: task.id,
        link: `/dashboard/inventory/count/${task.campaignId}`,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      task: updatedTask,
      message: assignTo
        ? "Recount requested and assigned successfully"
        : "Recount requested successfully",
    });
  } catch (error) {
    console.error("Error requesting recount:", error);
    return NextResponse.json(
      { error: "Failed to request recount" },
      { status: 500 }
    );
  }
}
