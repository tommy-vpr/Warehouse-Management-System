// app/api/inventory/cycle-counts/campaigns/[id]/complete/route.ts
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

    const { id } = await params;

    // Get campaign with tasks
    const campaign = await prisma.cycleCountCampaign.findUnique({
      where: { id },
      include: {
        tasks: {
          include: {
            productVariant: true,
            location: true,
          },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    const incompleteTasks = campaign.tasks.filter(
      (task) =>
        !["COMPLETED", "SKIPPED", "CANCELLED", "VARIANCE_REVIEW"].includes(
          task.status
        )
    );

    if (incompleteTasks.length > 0) {
      return NextResponse.json(
        {
          error: "Cannot complete campaign with incomplete tasks",
          incompleteTasks: incompleteTasks.length,
        },
        { status: 400 }
      );
    }

    // Calculate final statistics including review tasks
    const completedTasks = campaign.tasks.filter(
      (task) => task.status === "COMPLETED"
    ).length;

    const reviewTasks = campaign.tasks.filter(
      (task) => task.status === "VARIANCE_REVIEW"
    ).length;

    const varianceTasks = campaign.tasks.filter(
      (task) => task.variance !== null && task.variance !== 0
    ).length;

    // ⭐ UPDATE CAMPAIGN STATUS - This was missing!
    const updatedCampaign = await prisma.cycleCountCampaign.update({
      where: { id },
      data: {
        status: "COMPLETED",
        endDate: new Date(),
        completedTasks: completedTasks + reviewTasks, // Include both
        variancesFound: varianceTasks,
        updatedAt: new Date(),
      },
    });

    // Create completion events for each task
    const eventPromises = campaign.tasks.map((task) =>
      prisma.cycleCountEvent.create({
        data: {
          taskId: task.id,
          eventType: "TASK_COMPLETED",
          userId: session.user.id,
          notes: "Campaign completed",
          metadata: {
            campaignCompleted: true,
            finalStatus: task.status,
          },
        },
      })
    );

    await Promise.all(eventPromises);

    // Generate completion summary
    const summary = {
      campaignId: id,
      totalTasks: campaign.totalTasks,
      completedTasks,
      skippedTasks: campaign.tasks.filter((task) => task.status === "SKIPPED")
        .length,
      varianceTasks,
      reviewTasks,
      accuracyPercentage:
        completedTasks > 0
          ? ((completedTasks - varianceTasks) / completedTasks) * 100
          : 100,
      completedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      campaign: updatedCampaign,
      summary,
    });
  } catch (error) {
    console.error("Error completing campaign:", error);
    return NextResponse.json(
      { error: "Failed to complete campaign" },
      { status: 500 }
    );
  }
}
