// import { NextRequest, NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";
// import { getServerSession } from "next-auth";
// import { authOptions } from "@/lib/auth";
// import { updateShopifyFulfillment } from "@/lib/shopify-fulfillment";

// export async function POST(
//   request: NextRequest,
//   { params }: { params: { orderId: string } }
// ) {
//   try {
//     const session = await getServerSession(authOptions);
//     if (!session?.user?.id) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     const { orderId } = params;
//     const body = await request.json();
//     const { trackingNumber, carrierCode, labelUrl, fulfillmentItems } = body;

//     // Get order with all details
//     const order = await prisma.order.findUnique({
//       where: { id: orderId },
//       include: {
//         items: {
//           include: {
//             productVariant: {
//               include: {
//                 product: true,
//                 inventory: {
//                   include: {
//                     location: true,
//                   },
//                 },
//               },
//             },
//           },
//         },
//       },
//     });

//     if (!order) {
//       return NextResponse.json({ error: "Order not found" }, { status: 404 });
//     }

//     if (order.status !== "SHIPPED") {
//       return NextResponse.json(
//         { error: "Order must be shipped before fulfillment" },
//         { status: 400 }
//       );
//     }

//     const result = await prisma.$transaction(async (tx) => {
//       const fulfillmentResults = [];

//       // Process each order item
//       for (const orderItem of order.items) {
//         let remainingQuantity = orderItem.quantity;

//         // Find inventory locations with reserved stock for this order
//         const inventoryLocations = orderItem.productVariant.inventory
//           .filter((inv) => inv.quantityReserved > 0)
//           .sort((a, b) => b.quantityReserved - a.quantityReserved); // Prioritize higher reserved quantities

//         for (const inventory of inventoryLocations) {
//           if (remainingQuantity <= 0) break;

//           const quantityToFulfill = Math.min(
//             remainingQuantity,
//             inventory.quantityReserved
//           );

//           // Update inventory: reduce both on-hand and reserved
//           const updatedInventory = await tx.inventory.update({
//             where: {
//               productVariantId_locationId: {
//                 productVariantId: orderItem.productVariantId,
//                 locationId: inventory.locationId,
//               },
//             },
//             data: {
//               quantityOnHand: {
//                 decrement: quantityToFulfill,
//               },
//               quantityReserved: {
//                 decrement: quantityToFulfill,
//               },
//             },
//           });

//           // Create SALE transaction record
//           await tx.inventoryTransaction.create({
//             data: {
//               productVariantId: orderItem.productVariantId,
//               locationId: inventory.locationId,
//               transactionType: "SALE",
//               quantityChange: -quantityToFulfill,
//               referenceId: orderId,
//               referenceType: "ORDER_FULFILLMENT",
//               userId: session.user.id,
//               notes: `Fulfilled ${quantityToFulfill} units for order ${
//                 order.orderNumber
//               }. Tracking: ${trackingNumber || "N/A"}`,
//             },
//           });

//           fulfillmentResults.push({
//             productVariantId: orderItem.productVariantId,
//             sku: orderItem.productVariant.sku,
//             locationId: inventory.locationId,
//             locationName: inventory.location.name,
//             quantityFulfilled: quantityToFulfill,
//             newOnHand: updatedInventory.quantityOnHand,
//             newReserved: updatedInventory.quantityReserved,
//             newAvailable:
//               updatedInventory.quantityOnHand -
//               updatedInventory.quantityReserved,
//           });

//           remainingQuantity -= quantityToFulfill;
//         }

//         if (remainingQuantity > 0) {
//           throw new Error(
//             `Unable to fulfill ${remainingQuantity} units of ${orderItem.productVariant.sku}. Insufficient reserved inventory.`
//           );
//         }
//       }

//       // Update order status to DELIVEred
//       const updatedOrder = await tx.order.update({
//         where: { id: orderId },
//         data: {
//           status: "DELIVERED",
//         },
//       });

//       return { order: updatedOrder, fulfillmentResults };
//     });

//     // Update Shopify with fulfillment info
//     let shopifyFulfillment = null;
//     if (order.shopifyOrderId && trackingNumber) {
//       try {
//         shopifyFulfillment = await updateShopifyFulfillment({
//           orderId: order.shopifyOrderId,
//           trackingNumber,
//           trackingCompany: carrierCode || "Other",
//           trackingUrl: labelUrl
//             ? `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`
//             : undefined,
//           lineItems: order.items.map((item) => ({
//             id: item.id,
//             quantity: item.quantity,
//           })),
//         });
//         console.log("✅ Shopify fulfillment updated");
//       } catch (error) {
//         console.warn("⚠️ Shopify fulfillment update failed:", error);
//         // Don't fail the whole process if Shopify update fails
//       }
//     }

//     return NextResponse.json({
//       success: true,
//       order: result.order,
//       fulfillmentResults: result.fulfillmentResults,
//       shopifyFulfillment,
//       message: `Order ${order.orderNumber} fulfilled successfully`,
//     });
//   } catch (error) {
//     console.error("Error fulfilling order:", error);

//     const errorMessage =
//       error instanceof Error ? error.message : "Failed to fulfill order";

//     return NextResponse.json({ error: errorMessage }, { status: 500 });
//   }
// }
