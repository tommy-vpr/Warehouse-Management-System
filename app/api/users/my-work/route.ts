// app/api/users/my-work/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const userId = session.user.id;

    console.log("📋 My Work Query:", { userId, type, status, page });

    // Build where clauses
    const workTaskWhere: any = { assignedTo: userId };
    if (type && type !== "all") workTaskWhere.type = type.toUpperCase();
    if (status && status !== "all") workTaskWhere.status = status;

    const includePickLists =
      !type || type === "all" || type.toLowerCase() === "picking";
    const pickListWhere: any = { assignedTo: userId };
    if (status && status !== "all") pickListWhere.status = status;

    // Fetch everything
    const [workTasks, pickLists] = await Promise.all([
      prisma.workTask.findMany({
        where: workTaskWhere,
        include: {
          assignedUser: { select: { id: true, name: true, email: true } },
          taskItems: {
            include: { order: { select: { id: true, orderNumber: true } } },
          },
        },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      }),
      includePickLists
        ? prisma.pickList.findMany({
            where: pickListWhere,
            include: {
              assignedUser: { select: { id: true, name: true, email: true } },
              items: {
                include: {
                  order: { select: { id: true, orderNumber: true } },
                },
              },
            },
            orderBy: [{ status: "asc" }, { createdAt: "desc" }],
          })
        : [],
    ]);

    console.log(
      `📊 Found: ${workTasks.length} WorkTasks, ${pickLists.length} PickLists`
    );

    // Transform WorkTasks
    const transformedWorkTasks = workTasks.map((task) => ({
      id: task.id,
      taskNumber: task.taskNumber,
      type: task.type,
      status: task.status,
      createdAt: task.createdAt.toISOString(),
      totalOrders: task.totalOrders,
      completedOrders: task.completedOrders,
      orderNumbers: Array.from(
        new Set(task.taskItems.map((i) => i.order?.orderNumber).filter(Boolean))
      ),
      orderIds: task.orderIds,
      progress:
        task.totalOrders > 0
          ? Math.round((task.completedOrders / task.totalOrders) * 100)
          : 0,
      priority: task.priority,
      notes: task.notes,
      source: task.type === "PACKING" ? "PACK_LIST" : "WORK_TASK",
    }));

    // Transform PickLists
    const transformedPickLists = pickLists.map((pl) => {
      // ✅ Calculate completed orders
      // An order is "completed" if ALL its items in this pick list are PICKED
      const orderCompletionStatus = new Map<
        string,
        { total: number; picked: number }
      >();

      pl.items.forEach((item: any) => {
        if (!item.orderId) return;

        if (!orderCompletionStatus.has(item.orderId)) {
          orderCompletionStatus.set(item.orderId, { total: 0, picked: 0 });
        }

        const orderStatus = orderCompletionStatus.get(item.orderId)!;
        orderStatus.total++;
        if (item.status === "PICKED") {
          orderStatus.picked++;
        }
      });

      // Count orders where all items are picked
      let completedOrdersCount = 0;
      for (const [orderId, orderStatus] of orderCompletionStatus.entries()) {
        if (orderStatus.picked === orderStatus.total && orderStatus.total > 0) {
          completedOrdersCount++;
        }
      }

      // Get unique order numbers
      const orderNumbers = Array.from(
        new Set(pl.items.map((i: any) => i.order?.orderNumber).filter(Boolean))
      );

      return {
        id: pl.id,
        taskNumber: pl.batchNumber,
        type: "PICKING" as const,
        status: pl.status,
        createdAt: pl.createdAt.toISOString(),
        totalOrders: orderCompletionStatus.size,
        completedOrders: completedOrdersCount, // ✅ Now calculated!
        orderNumbers,
        progress:
          pl.totalItems > 0
            ? Math.round((pl.pickedItems / pl.totalItems) * 100)
            : 0,
        priority: pl.priority,
        notes: pl.notes,
        source: "PICK_LIST" as const,
      };
    });

    // Combine and sort
    const allTasks = [...transformedWorkTasks, ...transformedPickLists].sort(
      (a, b) => {
        const statusOrder: any = {
          PENDING: 1,
          ASSIGNED: 2,
          IN_PROGRESS: 3,
          PAUSED: 4,
          PARTIALLY_COMPLETED: 5,
          COMPLETED: 6,
          CANCELLED: 7,
        };
        const statusDiff =
          (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
        return statusDiff !== 0
          ? statusDiff
          : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    );

    // Paginate
    const totalCount = allTasks.length;
    const totalPages = Math.ceil(totalCount / limit);
    const skip = (page - 1) * limit;
    const paginatedTasks = allTasks.slice(skip, skip + limit);

    console.log(
      `✅ Returning ${paginatedTasks.length}/${totalCount} tasks (page ${page})`
    );

    return NextResponse.json({
      tasks: paginatedTasks,
      totalCount,
      totalPages,
      currentPage: page,
    });
  } catch (error) {
    console.error("❌ My Work Error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch tasks",
        message: error instanceof Error ? error.message : "Unknown",
      },
      { status: 500 }
    );
  }
}
