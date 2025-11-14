// app/api/returns/[rmaNumber]/refund/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: { rmaNumber: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { rmaNumber } = params;
    const userId = session.user.id;

    console.log("💰 Processing refund for return:", rmaNumber);

    // Fetch return with all necessary data
    const returnOrder = await prisma.returnOrder.findUnique({
      where: { rmaNumber },
      include: {
        order: true,
        items: {
          include: {
            productVariant: true,
          },
        },
      },
    });

    if (!returnOrder) {
      return NextResponse.json({ error: "Return not found" }, { status: 404 });
    }

    // Validate return is ready for refund
    if (returnOrder.status !== "INSPECTION_COMPLETE") {
      return NextResponse.json(
        { error: "Return must be inspected before processing refund" },
        { status: 400 }
      );
    }

    if (returnOrder.refundStatus === "COMPLETED") {
      return NextResponse.json(
        { error: "Refund already processed" },
        { status: 400 }
      );
    }

    // Calculate refund amount based on restockable quantities
    const refundAmount = returnOrder.items.reduce((sum, item) => {
      // Only refund for restockable items (or adjust logic as needed)
      const refundableQty = item.quantityRestockable + item.quantityDisposed;
      return sum + parseFloat(item.unitPrice.toString()) * refundableQty;
    }, 0);

    // Apply restocking fee if applicable
    const restockingFee = returnOrder.restockingFee
      ? parseFloat(returnOrder.restockingFee.toString())
      : 0;
    const finalRefundAmount = refundAmount - restockingFee;

    console.log("💰 Refund calculation:", {
      refundAmount,
      restockingFee,
      finalRefundAmount,
    });

    // TODO: Process refund through Shopify API
    // const shopifyRefund = await createShopifyRefund({
    //   orderId: returnOrder.order.shopifyOrderId,
    //   amount: finalRefundAmount,
    //   reason: returnOrder.reason,
    //   items: returnOrder.items,
    // });

    // Simulate Shopify refund for now
    const shopifyRefundId = `refund_${Date.now()}`;

    // Update return with refund info
    const updatedReturn = await prisma.returnOrder.update({
      where: { rmaNumber },
      data: {
        status: "REFUNDED",
        refundStatus: "COMPLETED",
        refundAmount: finalRefundAmount,
        shopifyRefundId,
        shopifySyncStatus: "SYNCED",
      },
    });

    // Create event
    await prisma.returnEvent.create({
      data: {
        returnOrderId: updatedReturn.id,
        eventType: "REFUND_COMPLETED",
        userId,
        notes: `Refund of $${finalRefundAmount.toFixed(2)} processed`,
        data: {
          refundAmount: finalRefundAmount,
          shopifyRefundId,
        },
      },
    });

    // Update inventory for restocked items
    for (const item of returnOrder.items) {
      if (item.quantityRestockable > 0) {
        // Find or get a default storage location
        const storageLocation = await prisma.location.findFirst({
          where: { type: "STORAGE" },
        });

        if (!storageLocation) {
          throw new Error("No storage location found for restocking");
        }

        await prisma.inventory.updateMany({
          where: {
            productVariantId: item.productVariantId,
            locationId: storageLocation.id,
          },
          data: {
            quantityOnHand: {
              increment: item.quantityRestockable,
            },
          },
        });

        // Create inventory transaction - FIX: use transactionType instead of type
        await prisma.inventoryTransaction.create({
          data: {
            productVariantId: item.productVariantId,
            locationId: storageLocation.id, // ADD: required field
            transactionType: "RETURNS", // FIX: was "type"
            quantityChange: item.quantityRestockable,
            referenceType: "RETURN",
            referenceId: returnOrder.id,
            userId,
            notes: `Restocked from return ${rmaNumber}`,
          },
        });
      }
    }

    console.log("✅ Refund processed successfully:", rmaNumber);

    // TODO: Send refund confirmation email
    // await sendRefundConfirmationEmail(
    //   returnOrder.customerEmail,
    //   rmaNumber,
    //   finalRefundAmount
    // );

    return NextResponse.json({
      success: true,
      returnOrder: updatedReturn,
      refundAmount: finalRefundAmount,
      shopifyRefundId,
    });
  } catch (error) {
    console.error("❌ Error processing refund:", error);
    return NextResponse.json(
      { error: "Failed to process refund" },
      { status: 500 }
    );
  }
}
