import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    // ✅ Get order details WITH ALL back orders AND IMAGES
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            productVariant: {
              include: {
                product: true,
              },
            },
          },
        },
        // ✅ Get ALL back orders (not filtered by status)
        backOrders: true,
        // ✅ Include order images
        images: {
          orderBy: {
            createdAt: "desc",
          },
        },
        packages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            labelUrl: true,
            packingSlipUrl: true,
            trackingNumber: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // ✅ Fetch all pick list items for this order separately
    const pickListItems = await prisma.pickListItem.findMany({
      where: {
        orderId: id,
      },
      include: {
        pickList: {
          select: {
            status: true,
            batchNumber: true,
          },
        },
      },
    });

    // ✅ Categorize back orders by status
    const backOrdersByStatus = {
      pending: order.backOrders.filter(
        (bo) => bo.status === "PENDING" || bo.status === "ALLOCATED"
      ),
      inProgress: order.backOrders.filter(
        (bo) =>
          bo.status === "PICKING" ||
          bo.status === "PICKED" ||
          bo.status === "PACKED"
      ),
      fulfilled: order.backOrders.filter((bo) => bo.status === "FULFILLED"),
    };

    console.log("📦 Back order status breakdown:", {
      pending: backOrdersByStatus.pending.length,
      inProgress: backOrdersByStatus.inProgress.length,
      fulfilled: backOrdersByStatus.fulfilled.length,
    });

    // ✅ CRITICAL LOGIC: Determine what we're packing (accounting for short picks)
    const itemsToPack = order.items.map((item) => {
      // ✅ Calculate actual picked quantity from pick list items
      const itemPickListItems = pickListItems.filter(
        (pli) => pli.productVariantId === item.productVariantId
      );

      console.log(`\n📦 Processing item: ${item.productVariant.sku}`);
      console.log(`  - Order quantity: ${item.quantity}`);
      console.log(`  - Found ${itemPickListItems.length} pick list items`);

      itemPickListItems.forEach((pli, index) => {
        console.log(`  - Pick list item ${index + 1}:`, {
          status: pli.status,
          quantityToPick: pli.quantityToPick,
          quantityPicked: pli.quantityPicked,
          pickListStatus: pli.pickList.status,
        });
      });

      // ✅ Only count items that have been picked (status = PICKED or SHORT_PICK)
      const totalPickedQuantity = itemPickListItems.reduce((sum, pli) => {
        if (pli.status === "PICKED" || pli.status === "SHORT_PICK") {
          return sum + (pli.quantityPicked || 0);
        }
        return sum;
      }, 0);

      console.log(`  - Total picked quantity: ${totalPickedQuantity}`);

      // Check for pending items
      const hasPendingItems = itemPickListItems.some(
        (pli) => pli.status === "PENDING"
      );

      // Find back orders for this product
      const pendingBO = backOrdersByStatus.pending.find(
        (bo) => bo.productVariantId === item.productVariantId
      );
      const inProgressBO = backOrdersByStatus.inProgress.find(
        (bo) => bo.productVariantId === item.productVariantId
      );
      const fulfilledBO = backOrdersByStatus.fulfilled.find(
        (bo) => bo.productVariantId === item.productVariantId
      );

      let quantityToPack = 0;
      let quantityBackOrdered = 0;
      let quantityAlreadyShipped = 0;
      let packingContext = "FULL_ORDER";
      let wasShortPicked = false;

      // ✅ Use actual picked quantity, not quantityToPick
      const actualAvailableQuantity = totalPickedQuantity;

      if (inProgressBO) {
        // ✅ CASE 1: We're packing back-ordered items (PICKED/PACKED status)
        quantityToPack =
          inProgressBO.quantityBackOrdered - inProgressBO.quantityFulfilled;

        // Account for short picks on back orders too
        if (actualAvailableQuantity < quantityToPack) {
          wasShortPicked = true;
          quantityToPack = actualAvailableQuantity;
        }

        quantityAlreadyShipped = item.quantity - quantityToPack;
        quantityBackOrdered = 0;
        packingContext = "BACK_ORDER_FULFILLMENT";

        console.log(
          `  📦 Item ${
            item.productVariant.sku
          }: Packing back order (${quantityToPack} units)${
            wasShortPicked ? " [SHORT PICKED]" : ""
          }`
        );
      } else if (pendingBO) {
        // ✅ CASE 2: Initial order with some items on back order
        const backOrderQty =
          pendingBO.quantityBackOrdered - pendingBO.quantityFulfilled;

        // Use actual picked quantity
        quantityToPack = actualAvailableQuantity;
        quantityBackOrdered = item.quantity - actualAvailableQuantity;
        quantityAlreadyShipped = 0;
        packingContext = "PARTIAL_ORDER";

        // Check if this was a short pick
        const expectedToPick = item.quantity - backOrderQty;
        if (actualAvailableQuantity < expectedToPick) {
          wasShortPicked = true;
        }

        console.log(
          `  📦 Item ${item.productVariant.sku}: Packing ${quantityToPack} of ${
            item.quantity
          } (${quantityBackOrdered} on back order)${
            wasShortPicked ? " [SHORT PICKED]" : ""
          }`
        );
      } else if (fulfilledBO) {
        // ✅ CASE 3: All items already shipped
        quantityToPack = 0;
        quantityAlreadyShipped = item.quantity;
        quantityBackOrdered = 0;
        packingContext = "ALREADY_FULFILLED";

        console.log(`  ✅ Item ${item.productVariant.sku}: Already fulfilled`);
      } else {
        // ✅ CASE 4: Full order - use actual picked quantity
        quantityToPack = actualAvailableQuantity;
        quantityBackOrdered = 0;
        quantityAlreadyShipped = 0;
        packingContext = "FULL_ORDER";

        // Check if this was a short pick
        if (actualAvailableQuantity < item.quantity) {
          wasShortPicked = true;
          quantityBackOrdered = item.quantity - actualAvailableQuantity;
        }

        console.log(
          `  📦 Item ${
            item.productVariant.sku
          }: Full order (${quantityToPack} units)${
            wasShortPicked
              ? " [SHORT PICKED - " + quantityBackOrdered + " on back order]"
              : ""
          }`
        );
      }

      return {
        ...item,
        quantityToPack,
        quantityBackOrdered,
        quantityAlreadyShipped,
        packingContext,
        wasShortPicked,
        actualPickedQuantity: actualAvailableQuantity,
        hasPendingItems, // ✅ Track if there are unpicked items
      };
    });

    // ✅ Filter out items with nothing to pack
    const itemsToPackFiltered = itemsToPack.filter(
      (item) => item.quantityToPack > 0
    );

    // ✅ Check if there are pending items that need to be picked first
    const pendingItems = itemsToPack.filter((item) => item.hasPendingItems);

    if (pendingItems.length > 0 && itemsToPackFiltered.length === 0) {
      return NextResponse.json(
        {
          error:
            "Items are still being picked. Please complete picking before packing.",
          details: {
            pendingItems: pendingItems.map((item) => ({
              sku: item.productVariant.sku,
              name: item.productVariant.product.name,
              quantityOrdered: item.quantity,
              quantityPicked: item.actualPickedQuantity,
            })),
          },
        },
        { status: 400 }
      );
    }

    // ✅ Check if there's anything to pack
    if (itemsToPackFiltered.length === 0) {
      return NextResponse.json(
        {
          error:
            "No items available to pack. All items have been shipped or are on back order.",
        },
        { status: 400 }
      );
    }

    // ✅ Determine overall packing context
    const isBackOrderFulfillment = itemsToPackFiltered.some(
      (item) => item.packingContext === "BACK_ORDER_FULFILLMENT"
    );

    const hasShortPicks = itemsToPackFiltered.some(
      (item) => item.wasShortPicked
    );

    console.log(
      `📦 Packing context: ${
        isBackOrderFulfillment ? "BACK_ORDER" : "INITIAL_ORDER"
      }`
    );
    console.log(
      `📦 Total items to pack: ${itemsToPackFiltered.reduce(
        (sum, item) => sum + item.quantityToPack,
        0
      )}`
    );
    if (hasShortPicks) {
      console.log(`⚠️  Warning: Some items were short-picked`);
    }

    // ✅ Allow packing if items are picked OR packed OR shipped (for partial shipments)
    const allowedStatuses = [
      "PICKED",
      "PACKED",
      "SHIPPED",
      "BACKORDER",
      "PACKING",
    ];
    if (!allowedStatuses.includes(order.status)) {
      return NextResponse.json(
        {
          error: `Order must be picked before packing. Current status: ${order.status}`,
        },
        { status: 400 }
      );
    }

    // ✅ Calculate total weight using quantityToPack (actual picked quantity)
    const totalWeightGrams = itemsToPackFiltered.reduce((sum, item) => {
      const unitWeightGrams = item.productVariant.weight
        ? parseFloat(item.productVariant.weight.toString())
        : 94;
      return sum + unitWeightGrams * item.quantityToPack;
    }, 0);

    const totalWeightOz = totalWeightGrams * 0.035274;
    const totalWeightLbs = totalWeightGrams * 0.00220462;

    // ✅ Calculate total volume using quantityToPack (actual picked quantity)
    const totalVolume = itemsToPackFiltered.reduce((sum, item) => {
      const dims = item.productVariant.dimensions as any;
      let volume = 100;

      if (dims?.length && dims?.width && dims?.height) {
        volume = dims.length * dims.width * dims.height;
      }

      return sum + volume * item.quantityToPack;
    }, 0);

    let suggestedBox = "SMALL";
    if (totalVolume > 1000) suggestedBox = "LARGE";
    else if (totalVolume > 500) suggestedBox = "MEDIUM";

    const shippingAddr = order.shippingAddress as any;

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        status: order.status,
        totalAmount: order.totalAmount.toString(),
        shippingAddress: shippingAddr,
        billingAddress: order.billingAddress,
        isBackOrderFulfillment, // ✅ Add context flag
        hasShortPicks, // ✅ Flag for short picks
        // ✅ Include images in response
        images: order.images.map((img) => ({
          id: img.id,
          url: img.url,
          createdAt: img.createdAt.toISOString(),
        })),
        items: itemsToPackFiltered.map((item) => ({
          id: item.id,
          productVariantId: item.productVariantId,
          productName: item.productVariant.product.name,
          sku: item.productVariant.sku,
          quantity: item.quantityToPack, // ✅ What we're packing NOW (actual picked)
          originalQuantity: item.quantity, // ✅ Original order quantity
          quantityBackOrdered: item.quantityBackOrdered, // ✅ Still on back order
          quantityAlreadyShipped: item.quantityAlreadyShipped, // ✅ Already shipped
          wasShortPicked: item.wasShortPicked, // ✅ Flag for short picks
          actualPickedQuantity: item.actualPickedQuantity, // ✅ What was actually picked
          unitPrice: item.unitPrice.toString(),
          totalPrice: (
            parseFloat(item.unitPrice.toString()) * item.quantityToPack
          ).toFixed(2),
          weightGrams: item.productVariant.weight
            ? parseFloat(item.productVariant.weight.toString())
            : 94,
          weightOz: item.productVariant.weight
            ? parseFloat(item.productVariant.weight.toString()) * 0.035274
            : 3.31,
          dimensions: item.productVariant.dimensions,
        })),
        shippingPackages: order.packages,
      },
      packingInfo: {
        totalWeightGrams: Math.round(totalWeightGrams * 100) / 100,
        totalWeightOz: Math.round(totalWeightOz * 100) / 100,
        totalWeightLbs: Math.round(totalWeightLbs * 100) / 100,
        totalVolume: Math.round(totalVolume),
        suggestedBox,
        estimatedShippingCost: Math.round(totalWeightOz * 0.15 * 100) / 100,
      },
    });
  } catch (error) {
    console.error("Error fetching order for packing:", error);
    return NextResponse.json(
      { error: "Failed to fetch order details" },
      { status: 500 }
    );
  }
}
