// app/api/packing-tasks/[id]/route.ts
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const task = await prisma.workTask.findUnique({
      where: {
        id: id,
        type: "PACKING",
      },
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
                customerEmail: true,
                totalAmount: true,
              },
            },
            productVariant: {
              include: {
                product: true,
              },
            },
            location: true,
            completedByUser: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { sequence: "asc" },
        },
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: "Packing task not found" },
        { status: 404 }
      );
    }

    // ✅ Format items with proper null checks
    const items = task.taskItems.map((item) => ({
      id: item.id,
      sequence: item.sequence,
      status: item.status,
      order: item.order,
      product: item.productVariant
        ? {
            id: item.productVariant.id,
            sku: item.productVariant.sku || "",
            name: item.productVariant.name || "Unknown Product",
            brand: item.productVariant.product?.brand || null,
            upc: item.productVariant.barcode || null,
            barcode: item.productVariant.barcode || null,
            weight: item.productVariant.weight
              ? parseFloat(item.productVariant.weight.toString())
              : 0,
            dimensions: item.productVariant.dimensions || null,
          }
        : null,
      location: item.location,
      quantityRequired: item.quantityRequired,
      quantityCompleted: item.quantityCompleted,
      completedAt: item.completedAt?.toISOString() || null,
      completedBy: item.completedByUser || null,
      notes: item.notes || null,
    }));

    // ✅ Calculate stats
    const completedItems = items.filter(
      (item) => item.status === "COMPLETED"
    ).length;
    const pendingItems = items.filter(
      (item) => item.status === "PENDING"
    ).length;
    const inProgressItems = items.filter(
      (item) => item.status === "IN_PROGRESS"
    ).length;
    const issueItems = items.filter((item) => item.status === "ISSUE").length;
    const skippedItems = items.filter(
      (item) => item.status === "SKIPPED"
    ).length;

    // Calculate order-level stats
    const uniqueOrders = [...new Set(items.map((item) => item.order.id))];
    const orderCompletionMap = new Map();

    uniqueOrders.forEach((orderId) => {
      const orderItems = items.filter((item) => item.order.id === orderId);
      const allComplete = orderItems.every(
        (item) => item.status === "COMPLETED"
      );
      orderCompletionMap.set(orderId, allComplete);
    });

    const completedOrders = Array.from(orderCompletionMap.values()).filter(
      (complete) => complete
    ).length;

    const uniqueCustomers = [
      ...new Set(items.map((item) => item.order.customerName)),
    ];

    const totalValue = items.reduce((sum, item) => {
      return sum + parseFloat(item.order.totalAmount?.toString() || "0");
    }, 0);

    const totalWeight = items.reduce((sum, item) => {
      const weight = item.product?.weight || 0;
      return sum + weight * item.quantityRequired;
    }, 0);

    const progress =
      task.totalItems > 0
        ? Math.round((completedItems / task.totalItems) * 100)
        : 0;

    const stats = {
      totalItems: task.totalItems,
      completedItems: completedItems,
      progress: progress,
      pendingItems: pendingItems,
      inProgressItems: inProgressItems,
      completedItemsCount: completedItems,
      skippedItems: skippedItems,
      issueItems: issueItems,
      estimatedTimeRemaining: 0,
      elapsedTime: 0,
      totalOrders: uniqueOrders.length,
      completedOrders: completedOrders,
      uniqueOrders: uniqueOrders,
      uniqueCustomers: uniqueCustomers,
      totalValue: totalValue,
      totalWeight: totalWeight,
    };

    // ✅ Return in the format the component expects
    return NextResponse.json({
      task: {
        id: task.id,
        taskNumber: task.taskNumber,
        status: task.status,
        priority: task.priority || 0,
        assignedTo: task.assignedUser || null,
        assignedAt: task.assignedAt?.toISOString() || null,
        startedAt: task.startedAt?.toISOString() || null, // ✅ THIS IS KEY
        completedAt: task.completedAt?.toISOString() || null,
        notes: task.notes || null,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      },
      items: items,
      stats: stats,
      events: [],
    });
  } catch (error) {
    console.error("Error fetching packing task:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch packing task",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
