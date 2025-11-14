// app/api/orders/[id]/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

interface UpdateStatusRequest {
  status:
    | "PENDING"
    | "ALLOCATED"
    | "PICKING"
    | "PICKED"
    | "PACKED"
    | "SHIPPED"
    | "DELIVERED"
    | "CANCELLED"
    | "RETURNED"
    | "FULFILLED";
  trackingNumber?: string;
  trackingUrl?: string;
  shippedAt?: string;
  notes?: string;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const {
      status,
      trackingNumber,
      trackingUrl,
      shippedAt,
      notes,
    }: UpdateStatusRequest = await request.json();

    // Validate the order exists
    const existingOrder = await prisma.order.findUnique({
      where: { id },
      select: { id: true, status: true, orderNumber: true },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Prepare update data - only include fields that exist in your Order model
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    // Add shipping fields if they exist in your schema after migration
    if (status === "SHIPPED") {
      if (trackingNumber !== undefined)
        updateData.trackingNumber = trackingNumber;
      if (trackingUrl !== undefined) updateData.trackingUrl = trackingUrl;
      if (shippedAt) updateData.shippedAt = new Date(shippedAt);
    }

    // Update the order - no includes to avoid schema conflicts
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: updateData,
    });

    // Create inventory transaction for shipped orders
    if (status === "SHIPPED" && existingOrder.status !== "SHIPPED") {
      await prisma.$transaction(async (tx) => {
        // Get the order items separately to avoid include issues
        const orderWithItems = await tx.order.findUnique({
          where: { id },
          include: {
            items: {
              include: {
                productVariant: { select: { id: true } },
              },
            },
          },
        });

        if (orderWithItems?.items) {
          for (const item of orderWithItems.items) {
            await tx.inventoryTransaction.create({
              data: {
                productVariantId: item.productVariantId,
                transactionType: "SALE",
                quantityChange: -item.quantity,
                referenceId: orderWithItems.id,
                referenceType: "ORDER",
                userId: session.user.id,
                notes: `Order ${orderWithItems.orderNumber} shipped - ${
                  notes || "Shipping label created"
                }`,
              },
            });
          }
        }
      });
    }

    // Note: Removed OrderStatusHistory since it doesn't exist in your current schema
    // Add this back after you create the model if needed

    return NextResponse.json({
      success: true,
      order: {
        id: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        status: updatedOrder.status,
        updatedAt: updatedOrder.updatedAt,
        // These fields will be available after your migration
        ...(updatedOrder.trackingNumber && {
          trackingNumber: updatedOrder.trackingNumber,
        }),
        ...(updatedOrder.trackingUrl && {
          trackingUrl: updatedOrder.trackingUrl,
        }),
        ...(updatedOrder.shippedAt && { shippedAt: updatedOrder.shippedAt }),
      },
      message: `Order status updated to ${status}`,
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update order status",
      },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve order status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        // Include tracking fields if they exist after migration
        trackingNumber: true,
        trackingUrl: true,
        shippedAt: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({
      order,
      message: "Order status retrieved successfully",
    });
  } catch (error) {
    console.error("Error retrieving order status:", error);
    return NextResponse.json(
      { error: "Failed to retrieve order status" },
      { status: 500 }
    );
  }
}
