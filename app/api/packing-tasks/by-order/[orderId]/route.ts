// app/api/packing-tasks/by-order/[orderId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId } = await params;

    // Find active packing task that includes this order
    const task = await prisma.workTask.findFirst({
      where: {
        type: "PACKING",
        orderIds: {
          has: orderId,
        },
        status: {
          notIn: ["COMPLETED", "CANCELLED"],
        },
      },
      include: {
        assignedUser: {
          select: { id: true, name: true, email: true },
        },
        taskItems: true, // ✅ ADD THIS
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: "No active packing task found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      task: {
        id: task.id,
        taskNumber: task.taskNumber,
        status: task.status,
        assignedTo: task.assignedUser,
        totalItems: task.totalItems,
        completedItems: task.completedItems,
        taskItems: task.taskItems, // ✅ ADD THIS
      },
    });
  } catch (error) {
    console.error("Error finding packing task:", error);
    return NextResponse.json(
      { error: "Failed to find packing task" },
      { status: 500 }
    );
  }
}
