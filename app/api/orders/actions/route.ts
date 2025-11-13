// api/orders/actions
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { reserveOrderInventory } from "@/lib/reserveInventory";
import { fulfillOrderAndUpdateShopify } from "@/lib/fulfillOrderAndUpdateShopify";
import { generateBulkPickLists } from "@/lib/generateBulkPickLists";
import { generateSinglePickList } from "@/lib/generateSinglePickList";
import { updateOrderStatus } from "@/lib/order-status-helper";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { action, orderId, orderIds } = await request.json();

    switch (action) {
      case "ALLOCATE":
        // Allocate inventory
        const allocationResult = await reserveOrderInventory({
          orderId,
          userId: session.user.id,
        });

        // Create status history for allocation
        await updateOrderStatus({
          orderId,
          newStatus: "ALLOCATED",
          userId: session.user.id,
          notes: `Inventory allocated successfully - ${allocationResult.reservations.length} location(s)`,
        });
        break;

      // ✅ NEW: Handle allocation with back orders
      case "ALLOCATE_WITH_BACKORDER":
        const backorderResult = await reserveOrderInventory({
          orderId,
          userId: session.user.id,
          handleInsufficientInventory: "backorder",
        });

        // Create status history with back order info
        const backorderNotes = backorderResult.insufficientItems
          ? `Partial allocation - ${backorderResult.reservations.length} location(s) allocated, ${backorderResult.insufficientItems.length} back order(s) created`
          : `Inventory allocated successfully - ${backorderResult.reservations.length} location(s)`;

        await updateOrderStatus({
          orderId,
          newStatus: "ALLOCATED",
          userId: session.user.id,
          notes: backorderNotes,
        });
        break;

      // ✅ NEW: Handle allocation with cycle count
      case "ALLOCATE_WITH_COUNT":
        await reserveOrderInventory({
          orderId,
          userId: session.user.id,
          handleInsufficientInventory: "count",
        });
        // Note: Order status is NOT changed to ALLOCATED
        // It stays in PENDING until cycle count is completed and inventory is verified
        break;

      case "BULK_ALLOCATE":
        if (!orderIds || orderIds.length === 0) {
          return NextResponse.json(
            { error: "orderIds array is required for bulk allocation" },
            { status: 400 }
          );
        }

        const allocationResults = await Promise.allSettled(
          orderIds.map(async (id: string) => {
            const result = await reserveOrderInventory({
              orderId: id,
              userId: session.user.id,
            });

            await updateOrderStatus({
              orderId: id,
              newStatus: "ALLOCATED",
              userId: session.user.id,
              notes: `Bulk allocation - ${result.reservations.length} location(s)`,
            });

            return result;
          })
        );

        const successful = allocationResults.filter(
          (r) => r.status === "fulfilled"
        ).length;
        const failed = allocationResults.filter(
          (r) => r.status === "rejected"
        ).length;

        return NextResponse.json({
          success: true,
          message: `Bulk allocation completed: ${successful} successful, ${failed} failed`,
          successful,
          failed,
        });

      case "MARK_FULFILLED":
        // Fulfill order and update Shopify
        await fulfillOrderAndUpdateShopify(orderId, session.user.id);

        // Create status history for fulfillment
        await updateOrderStatus({
          orderId,
          newStatus: "FULFILLED",
          userId: session.user.id,
          notes: "Order marked as fulfilled",
        });
        break;

      case "GENERATE_SINGLE_PICK":
        try {
          // ✅ FIXED: Just generate - status update happens inside generateSinglePickList
          const result = await generateSinglePickList({
            orderIds: [orderId],
            pickingStrategy: "SINGLE",
            userId: session.user.id,
          });

          // Automatically start the pick list
          const startResponse = await fetch(
            `${
              process.env.NEXTAUTH_URL || "http://localhost:3000"
            }/api/picking/lists/${result.id}/start`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Cookie: request.headers.get("Cookie") || "",
              },
            }
          );

          if (!startResponse.ok) {
            console.error(
              "Failed to auto-start pick list:",
              startResponse.status
            );
          }

          console.log(
            `Generated and started single pick list ${result.batchNumber} for order ${orderId}`
          );
        } catch (error) {
          console.error(
            "Failed to generate and start single pick list:",
            error
          );
          throw error;
        }
        break;

      case "BULK_GENERATE_PICKS":
        // ✅ Generate bulk pick lists - status updates handled in /api/picking/generate
        await generateBulkPickLists(orderIds);
        break;

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `${action} completed successfully`,
    });
  } catch (error) {
    console.error("Action error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Action failed" },
      { status: 500 }
    );
  }
}
