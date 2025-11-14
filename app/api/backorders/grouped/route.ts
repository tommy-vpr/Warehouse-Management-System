// app/api/backorders/grouped/route.ts
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
    const status = searchParams.get("status");
    const readyForShipping = searchParams.get("readyForShipping") === "true";

    console.log("🔍 Grouped back orders query:", { status, readyForShipping });

    // Build where clause for back orders
    const backOrderWhere: any = {};

    if (status) {
      backOrderWhere.status = status;
    }

    if (readyForShipping) {
      // For shipping labels tab - only show PACKED back orders without packages
      backOrderWhere.status = "PACKED";
      backOrderWhere.shippingPackageId = null;
    }

    // Get orders that have back orders matching the criteria
    const orders = await prisma.order.findMany({
      where: {
        backOrders: {
          some: backOrderWhere,
        },
      },
      include: {
        backOrders: {
          where: backOrderWhere,
          include: {
            productVariant: {
              select: {
                id: true,
                sku: true,
                name: true,
                weight: true,
                dimensions: true,
                inventory: {
                  select: {
                    quantityOnHand: true,
                    quantityReserved: true,
                    locationId: true,
                  },
                },
              },
            },
            shippingPackage: {
              select: {
                id: true,
                trackingNumber: true,
                labelUrl: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    console.log(`📊 Found ${orders.length} orders with matching back orders`);

    // Group and calculate details
    const orderGroups = orders.map((order) => {
      const backOrders = order.backOrders;

      // Calculate total quantities
      const totalBackOrdered = backOrders.reduce(
        (sum, bo) => sum + bo.quantityBackOrdered,
        0
      );

      // Calculate inventory availability for each back order
      const backOrdersWithAvailability = backOrders.map((bo) => {
        const totalAvailable = bo.productVariant.inventory.reduce(
          (sum, inv) => sum + (inv.quantityOnHand - inv.quantityReserved),
          0
        );

        const remainingNeeded = bo.quantityBackOrdered - bo.quantityFulfilled;
        const canFulfill = totalAvailable >= remainingNeeded;

        // Parse dimensions from JSON field
        const dimensions = bo.productVariant.dimensions as any;
        const parsedDimensions = {
          length: dimensions?.length || null,
          width: dimensions?.width || null,
          height: dimensions?.height || null,
        };

        return {
          id: bo.id,
          productVariantId: bo.productVariantId,
          sku: bo.productVariant.sku,
          productName: bo.productVariant.name,
          quantityBackOrdered: bo.quantityBackOrdered,
          quantityFulfilled: bo.quantityFulfilled,
          remainingNeeded,
          status: bo.status,
          reason: bo.reason,
          reasonDetails: bo.reasonDetails,
          createdAt: bo.createdAt,
          fulfilledAt: bo.fulfilledAt,
          availableInventory: totalAvailable,
          canFulfill,
          weight: bo.productVariant.weight,
          dimensions: parsedDimensions,
          package: bo.shippingPackage
            ? {
                id: bo.shippingPackage.id,
                packageNumber: 1,
                trackingNumber: bo.shippingPackage.trackingNumber,
                shippingLabelUrl: bo.shippingPackage.labelUrl,
              }
            : null,
        };
      });

      // For shipping - calculate package weight/dimensions (in ounces)
      const totalWeight = backOrdersWithAvailability.reduce((sum, bo) => {
        const weightInGrams = bo.weight ? bo.weight.toNumber() : 0;
        const weightInOz = weightInGrams / 28.3495;
        return sum + weightInOz * bo.quantityBackOrdered;
      }, 0);

      // Check if all can be fulfilled
      const allCanFulfill = backOrdersWithAvailability.every(
        (bo) => bo.canFulfill
      );

      // For shipping - check if any are packed and ready
      const packedBackOrders = backOrders.filter(
        (bo) => bo.status === "PACKED" && !bo.shippingPackageId
      );
      const readyToShipTogether = packedBackOrders.length > 0;

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        orderStatus: order.status,
        hasShippingAddress: !!order.shippingAddress,
        backOrderCount: backOrders.length,
        totalBackOrdered,
        allCanFulfill,
        readyToShipTogether,
        estimatedWeight: totalWeight, // Already in ounces
        estimatedDimensions: {
          length: 12,
          width: 9,
          height: 6,
        },
        backOrders: backOrdersWithAvailability,
        createdAt: order.createdAt,
      };
    });

    // Filter out orders with no matching back orders
    const filtered = orderGroups.filter((g) => g.backOrderCount > 0);

    console.log(`✅ Returning ${filtered.length} order groups`);

    // Calculate stats
    const stats = {
      totalOrders: filtered.length,
      ordersReadyToAllocate: filtered.filter((g) => g.allCanFulfill).length,
      ordersReadyToShip: filtered.filter((g) => g.readyToShipTogether).length,
      totalBackOrders: filtered.reduce((sum, g) => sum + g.backOrderCount, 0),
      ordersWithMultipleBackOrders: filtered.filter((g) => g.backOrderCount > 1)
        .length,
    };

    return NextResponse.json({
      orders: filtered,
      stats,
    });
  } catch (error) {
    console.error("❌ Error fetching grouped back orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch grouped back orders" },
      { status: 500 }
    );
  }
}
