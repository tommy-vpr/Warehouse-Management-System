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

    // ✅ Enforce ADMIN MANAGER only
    const role = session.user?.role;

    if (!role || !["ADMIN", "MANAGER"].includes(role)) {
      return NextResponse.json(
        { error: "Forbidden: Approved by admin or manager only" },
        { status: 403 }
      );
    }

    const { notes } = await request.json();
    const { id } = await params;

    const task = await prisma.cycleCountTask.findUnique({
      where: { id },
      include: {
        campaign: true,
        productVariant: {
          include: { product: true },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // ✅ Wrap logic in transaction
    const updatedTask = await prisma.$transaction(async (tx) => {
      const updated = await tx.cycleCountTask.update({
        where: { id },
        data: {
          status: "COMPLETED",
          notes: notes
            ? `${task.notes || ""}\n[SUPERVISOR APPROVED] ${notes}`.trim()
            : task.notes,
        },
      });

      // ✅ Log event
      await tx.cycleCountEvent.create({
        data: {
          taskId: id,
          eventType: "TASK_COMPLETED",
          userId: session.user.id,
          previousValue: task.systemQuantity,
          newValue: task.countedQuantity,
          notes: `Variance approved by supervisor${notes ? `: ${notes}` : ""}`,
          metadata: {
            action: "VARIANCE_APPROVED",
            previousStatus: task.status,
            variance: task.variance,
            variancePercentage: task.variancePercentage?.toString(),
            approvedBy: session.user.id,
            systemQuantity: task.systemQuantity,
            countedQuantity: task.countedQuantity,
          },
        },
      });

      // ✅ Update campaign stats
      if (task.campaignId) {
        const campaignTasks = await tx.cycleCountTask.findMany({
          where: { campaignId: task.campaignId },
        });

        const completedCount = campaignTasks.filter((t) =>
          ["COMPLETED", "SKIPPED", "VARIANCE_REVIEW"].includes(
            t.id === id ? "COMPLETED" : t.status
          )
        ).length;

        await tx.cycleCountCampaign.update({
          where: { id: task.campaignId },
          data: { completedTasks: completedCount },
        });
      }

      return updated;
    });

    return NextResponse.json({
      success: true,
      task: updatedTask,
      message: "Variance approved successfully",
    });
  } catch (error) {
    console.error("Error approving variance:", error);
    return NextResponse.json(
      { error: "Failed to approve variance" },
      { status: 500 }
    );
  }
}

// import { NextRequest, NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";
// import { getServerSession } from "next-auth";
// import { authOptions } from "@/lib/auth";

// export async function POST(
//   request: NextRequest,
//   { params }: { params: { id: string } }
// ) {
//   try {
//     const session = await getServerSession(authOptions);
//     if (!session?.user?.id) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     const { notes } = await request.json();
//     const taskId = params.id;

//     const task = await prisma.cycleCountTask.findUnique({
//       where: { id: taskId },
//       include: {
//         campaign: true,
//         productVariant: {
//           include: {
//             product: true,
//           },
//         },
//       },
//     });

//     if (!task) {
//       return NextResponse.json({ error: "Task not found" }, { status: 404 });
//     }

//     // Update task status to COMPLETED
//     const updatedTask = await prisma.$transaction(async (tx) => {
//       const updated = await tx.cycleCountTask.update({
//         where: { id: taskId },
//         data: {
//           status: "COMPLETED",
//           notes: notes
//             ? `${task.notes || ""}\n[SUPERVISOR APPROVED] ${notes}`.trim()
//             : task.notes,
//         },
//       });

//       // ⭐ Create approval event with proper metadata
//       await tx.cycleCountEvent.create({
//         data: {
//           taskId,
//           eventType: "TASK_COMPLETED", // Better event type for completion
//           userId: session.user.id,
//           previousValue: task.systemQuantity,
//           newValue: task.countedQuantity,
//           notes: `Variance approved by supervisor${notes ? `: ${notes}` : ""}`,
//           metadata: {
//             action: "VARIANCE_APPROVED",
//             previousStatus: task.status,
//             variance: task.variance,
//             variancePercentage: task.variancePercentage?.toString(),
//             approvedBy: session.user.id,
//             systemQuantity: task.systemQuantity,
//             countedQuantity: task.countedQuantity,
//           },
//         },
//       });

//       // Update campaign stats if needed
//       if (task.campaignId) {
//         const campaignTasks = await tx.cycleCountTask.findMany({
//           where: { campaignId: task.campaignId },
//         });

//         const completedCount = campaignTasks.filter((t) =>
//           ["COMPLETED", "SKIPPED", "VARIANCE_REVIEW"].includes(
//             t.id === taskId ? "COMPLETED" : t.status
//           )
//         ).length;

//         await tx.cycleCountCampaign.update({
//           where: { id: task.campaignId },
//           data: { completedTasks: completedCount },
//         });
//       }

//       return updated;
//     });

//     return NextResponse.json({
//       success: true,
//       task: updatedTask,
//       message: "Variance approved successfully",
//     });
//   } catch (error) {
//     console.error("Error approving variance:", error);
//     return NextResponse.json(
//       { error: "Failed to approve variance" },
//       { status: 500 }
//     );
//   }
// }

// // import { NextRequest, NextResponse } from "next/server";
// // import { prisma } from "@/lib/prisma";
// // import { getServerSession } from "next-auth";
// // import { authOptions } from "@/lib/auth";

// // export async function POST(
// //   request: NextRequest,
// //   { params }: { params: { id: string } }
// // ) {
// //   try {
// //     const session = await getServerSession(authOptions);
// //     if (!session?.user?.id) {
// //       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
// //     }

// //     // Check if user has admin/manager role
// //     const user = await prisma.user.findUnique({
// //       where: { id: session.user.id },
// //       select: { role: true },
// //     });

// //     if (!user || !["ADMIN", "MANAGER"].includes(user.role)) {
// //       return NextResponse.json(
// //         { error: "Insufficient permissions. Admin or Manager role required." },
// //         { status: 403 }
// //       );
// //     }

// //     const { notes } = await request.json();
// //     const taskId = params.id;

// //     const task = await prisma.cycleCountTask.findUnique({
// //       where: { id: taskId },
// //       include: { campaign: true },
// //     });

// //     if (!task) {
// //       return NextResponse.json({ error: "Task not found" }, { status: 404 });
// //     }

// //     // Update task status to COMPLETED
// //     const updatedTask = await prisma.$transaction(async (tx) => {
// //       const updated = await tx.cycleCountTask.update({
// //         where: { id: taskId },
// //         data: {
// //           status: "COMPLETED",
// //           notes: notes
// //             ? `${task.notes || ""}\n[SUPERVISOR APPROVED] ${notes}`.trim()
// //             : task.notes,
// //         },
// //       });

// //       // Create approval event
// //       await tx.cycleCountEvent.create({
// //         data: {
// //           taskId,
// //           eventType: "VARIANCE_NOTED",
// //           userId: session.user.id,
// //           notes: `Variance approved by supervisor: ${notes || "No notes"}`,
// //           metadata: {
// //             action: "APPROVED",
// //             previousStatus: task.status,
// //             variance: task.variance,
// //           },
// //         },
// //       });

// //       // Update campaign stats if needed
// //       if (task.campaignId) {
// //         const campaignTasks = await tx.cycleCountTask.findMany({
// //           where: { campaignId: task.campaignId },
// //         });

// //         const completedCount = campaignTasks.filter((t) =>
// //           ["COMPLETED", "SKIPPED", "VARIANCE_REVIEW"].includes(
// //             t.id === taskId ? "COMPLETED" : t.status
// //           )
// //         ).length;

// //         await tx.cycleCountCampaign.update({
// //           where: { id: task.campaignId },
// //           data: { completedTasks: completedCount },
// //         });
// //       }

// //       return updated;
// //     });

// //     return NextResponse.json({
// //       success: true,
// //       task: updatedTask,
// //       message: "Variance approved successfully",
// //     });
// //   } catch (error) {
// //     console.error("Error approving variance:", error);
// //     return NextResponse.json(
// //       { error: "Failed to approve variance" },
// //       { status: 500 }
// //     );
// //   }
// // }
