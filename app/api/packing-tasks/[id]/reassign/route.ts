// app/api/packing-tasks/[id]/reassign/route.ts
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import type { ReassignmentReason } from "@/types/audit-trail";
import { notifyUser } from "@/lib/ably-server";
import { Prisma } from "@prisma/client";

type PackingTask = Prisma.WorkTaskGetPayload<{
  include: {
    assignedUser: { select: { id: true; name: true; email: true } };
    taskItems: {
      include: {
        order: {
          select: {
            id: true;
            orderNumber: true;
            customerName: true;
            status: true;
          };
        };
      };
    };
  };
}>;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, name: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.role !== "ADMIN" && user.role !== "MANAGER") {
      return NextResponse.json(
        {
          error:
            "Insufficient permissions. Only ADMIN and MANAGER roles can reassign packing tasks.",
        },
        { status: 403 }
      );
    }

    const managerName: string =
      user.name ?? session.user.name ?? session.user.email ?? "Unknown User";

    const { id: taskId } = await params;
    const body = await req.json();
    const { newStaffId, reason = "OTHER" as ReassignmentReason, notes } = body;

    if (!newStaffId) {
      return NextResponse.json(
        { error: "Missing required field: newStaffId" },
        { status: 400 }
      );
    }

    // Get current task with full details
    const task = await prisma.workTask.findUnique({
      where: { id: taskId },
      include: {
        assignedUser: {
          select: { id: true, name: true, email: true },
        },
        taskItems: {
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                customerName: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (task.type !== "PACKING") {
      return NextResponse.json(
        { error: "Task is not a packing task" },
        { status: 400 }
      );
    }

    // Check if task is already completed
    if (task.status === "COMPLETED" || task.status === "CANCELLED") {
      return NextResponse.json(
        { error: `Cannot reassign ${task.status.toLowerCase()} task` },
        { status: 400 }
      );
    }

    // Get new assignee
    const newUser = await prisma.user.findUnique({
      where: { id: newStaffId },
      select: { id: true, name: true, email: true },
    });

    if (!newUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Perform simple reassignment
    const result = await simpleReassignment(
      task,
      newStaffId,
      newUser,
      session.user.id,
      managerName,
      reason,
      notes
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Packing task reassignment error:", error);
    return NextResponse.json(
      {
        error: "Failed to reassign packing task",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

async function simpleReassignment(
  originalTask: PackingTask,
  newStaffId: string,
  newUser: { id: string; name: string | null; email: string | null },
  managerId: string,
  managerName: string,
  reason: ReassignmentReason,
  notes?: string
) {
  return await prisma.$transaction(async (tx) => {
    // Calculate progress
    const totalOrders = originalTask.taskItems.length;
    const completedOrders = originalTask.taskItems.filter(
      (item) => item.status === "COMPLETED"
    ).length;

    // Update task
    const updated = await tx.workTask.update({
      where: { id: originalTask.id },
      data: {
        assignedTo: newStaffId,
        status: completedOrders === 0 ? "ASSIGNED" : "IN_PROGRESS",
      },
      include: {
        assignedUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Update orders
    await tx.order.updateMany({
      where: { id: { in: originalTask.orderIds } },
      data: {
        packingAssignedTo: newStaffId,
        packingAssignedAt: new Date(),
      },
    });

    // Create task event for reassignment
    await tx.taskEvent.create({
      data: {
        taskId: originalTask.id,
        eventType: "TASK_REASSIGNED",
        userId: managerId,
        data: {
          taskId: originalTask.id,
          taskNumber: originalTask.taskNumber,
          fromUserId: originalTask.assignedTo,
          fromUserName: originalTask.assignedUser?.name,
          toUserId: newStaffId,
          toUserName: newUser.name,
          reason,
          reassignedBy: managerId,
          reassignedByName: managerName,
          progress: {
            completedOrders,
            totalOrders,
          },
        },
        notes:
          notes ||
          `Reassigned from ${originalTask.assignedUser?.name || "Unassigned"} to ${newUser.name}`,
      },
    });

    // Notify new user
    await notifyUser(newStaffId, {
      type: "TASK_ASSIGNED",
      title: "New Packing Task Assigned",
      message: `You've been assigned packing task ${originalTask.taskNumber} by ${managerName}.`,
      link: `/dashboard/packing/progress/${originalTask.id}`,
      metadata: {
        reassignedBy: managerName,
        reason,
      },
    });

    return {
      success: true,
      task: {
        id: updated.id,
        taskNumber: updated.taskNumber,
        assignedTo: updated.assignedTo || "",
        assignedToUser: updated.assignedUser,
      },
    };
  });
}
