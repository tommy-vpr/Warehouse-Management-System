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
    const {
      newStaffId,
      strategy = "split",
      reason = "OTHER" as ReassignmentReason,
      notes,
    } = body;

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

    // Get new assignee
    const newUser = await prisma.user.findUnique({
      where: { id: newStaffId },
      select: { id: true, name: true, email: true },
    });

    if (!newUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check for partial completion
    const completedItems = task.taskItems.filter(
      (item) => item.status === "COMPLETED"
    );
    const inProgressItems = task.taskItems.filter(
      (item) => item.status === "IN_PROGRESS"
    );
    const pendingItems = task.taskItems.filter(
      (item) => item.status === "PENDING"
    );

    if (completedItems.length === task.taskItems.length) {
      return NextResponse.json(
        { error: "Nothing to reassign - task is complete" },
        { status: 400 }
      );
    }

    let result;

    if (strategy === "split" && completedItems.length > 0) {
      // Strategy 1: Create new task for remainder
      result = await createContinuationTask(
        task,
        inProgressItems,
        pendingItems,
        newStaffId,
        newUser,
        session.user.id,
        managerName,
        reason,
        notes
      );
    } else {
      // Strategy 2: Simple reassignment
      result = await simpleReassignment(
        task,
        newStaffId,
        newUser,
        session.user.id,
        managerName,
        reason,
        notes
      );
    }

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

async function createContinuationTask(
  originalTask: PackingTask,
  inProgressItems: PackingTask["taskItems"],
  pendingItems: PackingTask["taskItems"],
  newStaffId: string,
  newUser: { id: string; name: string | null; email: string | null },
  managerId: string,
  managerName: string,
  reason: ReassignmentReason,
  notes?: string
) {
  return await prisma.$transaction(async (tx) => {
    const remainingWork = [];

    // Handle in-progress items (reset them)
    for (const item of inProgressItems) {
      remainingWork.push({
        orderId: item.orderId,
        quantityRequired: item.quantityRequired,
        sequence: item.sequence,
        notes: `Continuation from ${originalTask.taskNumber}`,
      });

      // Mark as completed in original
      await tx.taskItem.update({
        where: { id: item.id },
        data: {
          status: "COMPLETED",
        },
      });
    }

    // Add pending items
    for (const item of pendingItems) {
      remainingWork.push({
        orderId: item.orderId,
        quantityRequired: item.quantityRequired,
        sequence: item.sequence,
        notes: `Moved from ${originalTask.taskNumber}`,
      });

      // Mark as completed in original (they're moving)
      await tx.taskItem.update({
        where: { id: item.id },
        data: {
          status: "COMPLETED",
        },
      });
    }

    // Create continuation task
    const continuationTask = await tx.workTask.create({
      data: {
        taskNumber: `${originalTask.taskNumber}-CONT`,
        type: "PACKING",
        assignedTo: newStaffId,
        status: "ASSIGNED",
        priority: originalTask.priority + 1,
        orderIds: remainingWork.map((item) => item.orderId),
        totalOrders: remainingWork.length,
        totalItems: remainingWork.reduce(
          (sum, item) => sum + item.quantityRequired,
          0
        ),
        notes: `Continuation of ${originalTask.taskNumber}`,
        taskItems: {
          create: remainingWork,
        },
      },
      include: {
        taskItems: {
          include: {
            order: true,
          },
        },
        assignedUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Mark original as partially completed
    await tx.workTask.update({
      where: { id: originalTask.id },
      data: {
        status: "PARTIALLY_COMPLETED",
        completedAt: new Date(),
        notes: `Partially completed - continued in ${continuationTask.taskNumber}`,
      },
    });

    // Update orders for continuation
    await tx.order.updateMany({
      where: { id: { in: remainingWork.map((item) => item.orderId) } },
      data: {
        packingAssignedTo: newStaffId,
        packingAssignedAt: new Date(),
      },
    });

    // Create task event for split
    await tx.taskEvent.create({
      data: {
        taskId: continuationTask.id,
        eventType: "TASK_SPLIT",
        userId: managerId,
        data: {
          originalTaskId: originalTask.id,
          originalTaskNumber: originalTask.taskNumber,
          continuationTaskId: continuationTask.id,
          continuationTaskNumber: continuationTask.taskNumber,
          fromUserId: originalTask.assignedTo,
          fromUserName: originalTask.assignedUser?.name,
          toUserId: newStaffId,
          toUserName: newUser.name,
          reason,
          reassignedBy: managerId,
          reassignedByName: managerName,
          inProgressItemsSplit: inProgressItems.length,
          pendingItemsMoved: pendingItems.length,
        },
        notes:
          notes ||
          `Task split - ${inProgressItems.length} in-progress items, ${pendingItems.length} pending items`,
      },
    });

    // Notify new user
    await notifyUser(newStaffId, {
      type: "TASK_ASSIGNED",
      title: "Continuation Packing Task Assigned",
      message: `You've been assigned a continuation packing task ${continuationTask.taskNumber} (from ${originalTask.taskNumber}) by ${managerName}.`,
      link: `/dashboard/packing/pack/${continuationTask.id}`,
      metadata: {
        continuationOf: originalTask.taskNumber,
        reassignedBy: managerName,
        reason,
      },
    });

    // Create task event for assignment
    await tx.taskEvent.create({
      data: {
        taskId: continuationTask.id,
        eventType: "TASK_ASSIGNED",
        userId: newStaffId,
        data: {
          taskId: continuationTask.id,
          taskNumber: continuationTask.taskNumber,
          originalTaskId: originalTask.id,
          originalTaskNumber: originalTask.taskNumber,
          reason,
          assignedBy: managerId,
          assignedByName: managerName,
        },
        notes: `Assigned continuation from ${originalTask.taskNumber}`,
      },
    });

    return {
      success: true,
      original: {
        id: originalTask.id,
        taskNumber: originalTask.taskNumber,
        status: "PARTIALLY_COMPLETED",
      },
      continuation: {
        id: continuationTask.id,
        taskNumber: continuationTask.taskNumber,
        assignedTo: newStaffId,
        assignedToUser: continuationTask.assignedUser,
      },
      summary: {
        inProgressItemsSplit: inProgressItems.length,
        pendingItemsMoved: pendingItems.length,
        totalItemsInContinuation: remainingWork.length,
      },
    };
  });
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
          `Reassigned from ${originalTask.assignedUser?.name} to ${newUser.name}`,
      },
    });

    // Notify new user
    await notifyUser(newStaffId, {
      type: "TASK_ASSIGNED",
      title: "New Packing Task Assigned",
      message: `You've been assigned packing task ${originalTask.taskNumber} by ${managerName}.`,
      link: `/tasks/packing/${originalTask.id}`,
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
