// app/api/inventory/cycle-counts/[id]/complete/route.ts - Real implementation
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const taskId = params.id;

    // Get the task with all related data
    const task = await prisma.cycleCountTask.findUnique({
      where: { id: taskId },
      include: {
        productVariant: true,
        location: true,
        events: true,
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Update task status
    await prisma.cycleCountTask.update({
      where: { id: taskId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    // Create completion event
    await prisma.cycleCountEvent.create({
      data: {
        taskId,
        eventType: "TASK_COMPLETED",
        userId: session.user.id,
        notes: "Cycle count completed",
      },
    });

    // Update campaign progress if this task belongs to a campaign
    if (task.campaignId) {
      const campaign = await prisma.cycleCountCampaign.findUnique({
        where: { id: task.campaignId },
        include: { tasks: true },
      });

      if (campaign) {
        const completedTasks = campaign.tasks.filter(
          (t) => t.status === "COMPLETED"
        ).length;
        const varianceTasks = campaign.tasks.filter(
          (t) => t.variance !== null && t.variance !== 0
        ).length;

        await prisma.cycleCountCampaign.update({
          where: { id: task.campaignId },
          data: {
            completedTasks,
            variancesFound: varianceTasks,
            status:
              completedTasks === campaign.totalTasks ? "COMPLETED" : "ACTIVE",
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Cycle count completed successfully",
    });
  } catch (error) {
    console.error("Error completing cycle count:", error);
    return NextResponse.json(
      { error: "Failed to complete cycle count" },
      { status: 500 }
    );
  }
}
