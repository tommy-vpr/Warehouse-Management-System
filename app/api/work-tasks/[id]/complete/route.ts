// app/api/work-tasks/[id]/complete-item/route.ts
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> } // ✅ Add Promise
) {
  try {
    const { id: taskId } = await params;

    const task = await prisma.workTask.findUnique({
      where: { id: taskId },
      include: {
        taskItems: true,
        assignedUser: true,
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (err) {
    console.error("Error loading task:", err);
    return NextResponse.json({ error: "Failed to load task" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  return NextResponse.json({
    success: true,
    message: "POST route works!",
    taskId: id,
    receivedData: body,
    timestamp: new Date().toISOString(),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> } // ✅ Add Promise
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { taskItemId, quantityCompleted, notes } = await req.json();
    const { id: taskId } = await params;
    console.log("🔵 PATCH hit with ID:", taskId);

    // Get the task item
    const taskItem = await prisma.taskItem.findUnique({
      where: { id: taskItemId },
      include: {
        task: {
          include: {
            taskItems: true,
          },
        },
      },
    });

    if (!taskItem) {
      return NextResponse.json(
        { error: "Task item not found" },
        { status: 404 }
      );
    }

    // Update the task item
    const updatedItem = await prisma.taskItem.update({
      where: { id: taskItemId },
      data: {
        status: "COMPLETED",
        quantityCompleted: quantityCompleted || taskItem.quantityRequired,
        completedBy: session.user.id,
        completedAt: new Date(),
        notes,
      },
    });

    // ✅ INCREMENT completedItems
    await prisma.workTask.update({
      where: { id: taskId },
      data: {
        completedItems: { increment: 1 },
      },
    });

    // ✅ CHECK if all items for this ORDER are complete
    const orderItems = taskItem.task.taskItems.filter(
      (item) => item.orderId === taskItem.orderId
    );

    const allOrderItemsComplete = orderItems.every(
      (item) => item.id === taskItemId || item.status === "COMPLETED"
    );

    // ✅ If order complete, increment completedOrders
    if (allOrderItemsComplete) {
      await prisma.workTask.update({
        where: { id: taskId },
        data: {
          completedOrders: { increment: 1 },
        },
      });

      // Create event for order completion
      await prisma.taskEvent.create({
        data: {
          taskId,
          eventType: "ITEM_COMPLETED",
          userId: session.user.id,
          notes: `Order ${taskItem.orderId} completed`,
        },
      });
    }

    // ✅ CHECK if entire task is complete
    const updatedTask = await prisma.workTask.findUnique({
      where: { id: taskId },
    });

    if (updatedTask && updatedTask.completedOrders >= updatedTask.totalOrders) {
      // ✅ Get actual count of completed items
      const actualCompletedItems = await prisma.taskItem.count({
        where: {
          taskId: taskId,
          status: "COMPLETED",
        },
      });

      await prisma.workTask.update({
        where: { id: taskId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          completedItems: actualCompletedItems, // ✅ Use actual count
        },
      });

      await prisma.taskEvent.create({
        data: {
          taskId,
          eventType: "TASK_COMPLETED",
          userId: session.user.id,
          notes: `Task completed - ${updatedTask.totalOrders} orders done`,
        },
      });

      // Update order statuses based on task type
      if (updatedTask.type === "PICKING") {
        await prisma.order.updateMany({
          where: { id: { in: updatedTask.orderIds } },
          data: { status: "PICKED", currentStage: "PACKING" },
        });
      } else if (updatedTask.type === "PACKING") {
        await prisma.order.updateMany({
          where: { id: { in: updatedTask.orderIds } },
          data: { status: "PACKED", currentStage: "SHIPPING" },
        });
      } else if (updatedTask.type === "SHIPPING") {
        await prisma.order.updateMany({
          where: { id: { in: updatedTask.orderIds } },
          data: { status: "SHIPPED" },
        });
      }
    }

    return NextResponse.json({
      success: true,
      taskItem: updatedItem,
      progress: {
        completedItems: updatedTask?.completedItems || 0,
        totalItems: updatedTask?.totalItems || 0,
        completedOrders: updatedTask?.completedOrders || 0,
        totalOrders: updatedTask?.totalOrders || 0,
        orderProgress:
          updatedTask && updatedTask.totalOrders > 0
            ? Math.round(
                (updatedTask.completedOrders / updatedTask.totalOrders) * 100
              )
            : 0,
      },
      taskComplete: updatedTask?.status === "COMPLETED",
    });
  } catch (error) {
    console.error("Error completing task item:", error);
    return NextResponse.json(
      { error: "Failed to complete task item" },
      { status: 500 }
    );
  }
}
