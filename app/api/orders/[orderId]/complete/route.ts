// import { NextRequest, NextResponse } from "next/server";
// import { shipengine } from "@/lib/shipengine";
// import { prisma } from "@/lib/prisma";
// import { getServerSession } from "next-auth";
// import { authOptions } from "@/lib/auth";
// import { updateShopifyFulfillment } from "@/lib/shopify-fulfillment";

// export async function POST(
//   request: NextRequest,
//   { params }: { params: Promise<{ orderId: string }> }
// ) {
//   try {
//     const session = await getServerSession(authOptions);
//     if (!session?.user?.id) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     const { orderId } = await params;
//     const { serviceCode, carrierCode } = await request.json();

//     console.log(`🚀 Starting complete fulfillment for order: ${orderId}`);

//     // Get order details
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
//         { error: "Order must be SHIPPED before completion" },
//         { status: 400 }
//       );
//     }

//     console.log(`📦 Processing order: ${order.orderNumber}`);

//     // Step 1: Create shipping label with correct Shopify address mapping
//     console.log("🏷️ Creating shipping label...");

//     const warehouseAddress = {
//       name: process.env.WAREHOUSE_NAME || "WMS Warehouse",
//       company_name: process.env.WAREHOUSE_COMPANY || "Your Company",
//       address_line1: process.env.WAREHOUSE_ADDRESS1 || "123 Warehouse St",
//       city_locality: process.env.WAREHOUSE_CITY || "Los Angeles",
//       state_province: process.env.WAREHOUSE_STATE || "CA",
//       postal_code: process.env.WAREHOUSE_ZIP || "90210",
//       country_code: "US",
//       phone: process.env.WAREHOUSE_PHONE || "555-123-4567",
//     };

//     // Properly map Shopify address format to ShipEngine format
//     const shippingAddr = order.shippingAddress as any;

//     if (!shippingAddr || typeof shippingAddr !== "object") {
//       console.warn(
//         `⚠️ Missing or malformed shipping address for order ${order.id}`
//       );
//     }

//     const customerAddress = {
//       name: shippingAddr?.name || order.customerName || "Customer",
//       company_name: shippingAddr?.company || undefined,
//       address_line1: shippingAddr?.address1 || "123 Customer St",
//       address_line2: shippingAddr?.address2 || undefined,
//       city_locality: shippingAddr?.city || "Customer City",
//       state_province:
//         shippingAddr?.province_code || shippingAddr?.province || "CA", // Use province_code first
//       postal_code: shippingAddr?.zip || "90210",
//       country_code: shippingAddr?.country_code || "US",
//       phone: shippingAddr?.phone || "555-123-4567",
//       address_residential_indicator: "yes" as const,
//     };

//     console.log(
//       "🏠 Warehouse address:",
//       JSON.stringify(warehouseAddress, null, 2)
//     );
//     console.log(
//       "🏠 Customer address:",
//       JSON.stringify(customerAddress, null, 2)
//     );

//     const shipment = {
//       ship_from: warehouseAddress,
//       ship_to: customerAddress,
//       packages: [
//         {
//           weight: {
//             value:
//               order.items.reduce(
//                 (total, item) =>
//                   total +
//                   (Number(item.productVariant.weight) || 1) * item.quantity,
//                 0
//               ) || 1,
//             unit: "pound" as const,
//           },
//           dimensions: {
//             unit: "inch" as const,
//             length: 12,
//             width: 9,
//             height: 6,
//           },
//           label_messages: {
//             reference1: order.orderNumber,
//             reference2: `Items: ${order.items.length}`,
//           },
//         },
//       ],
//       service_code: serviceCode || undefined,
//     };

//     console.log("📦 Creating shipment...");

//     const label = await shipengine.createLabelFromShipment(shipment, {
//       test_label: process.env.SHIPENGINE_SANDBOX === "true",
//       label_format: "pdf",
//       label_layout: "4x6",
//     });

//     console.log(`✅ Label created - Tracking: ${label.tracking_number}`);

//     // Step 2: Update order to SHIPPED
//     await prisma.order.update({
//       where: { id: orderId },
//       data: { status: "SHIPPED" },
//     });

//     // Step 3: Fulfill inventory (reduce stock)
//     console.log("📦 Fulfilling inventory...");
//     const fulfillmentResult = await prisma.$transaction(async (tx) => {
//       const fulfillmentResults = [];

//       for (const orderItem of order.items) {
//         let remainingQuantity = orderItem.quantity;

//         const inventoryLocations = orderItem.productVariant.inventory
//           .filter((inv) => inv.quantityReserved > 0)
//           .sort((a, b) => b.quantityReserved - a.quantityReserved);

//         for (const inventory of inventoryLocations) {
//           if (remainingQuantity <= 0) break;

//           const quantityToFulfill = Math.min(
//             remainingQuantity,
//             inventory.quantityReserved
//           );

//           const updatedInventory = await tx.inventory.update({
//             where: {
//               productVariantId_locationId: {
//                 productVariantId: orderItem.productVariantId,
//                 locationId: inventory.locationId,
//               },
//             },
//             data: {
//               quantityOnHand: { decrement: quantityToFulfill },
//               quantityReserved: { decrement: quantityToFulfill },
//             },
//           });

//           await tx.inventoryTransaction.create({
//             data: {
//               productVariantId: orderItem.productVariantId,
//               locationId: inventory.locationId,
//               transactionType: "SALE",
//               quantityChange: -quantityToFulfill,
//               referenceId: orderId,
//               referenceType: "ORDER_FULFILLMENT",
//               userId: session.user.id,
//               notes: `Fulfilled order ${order.orderNumber} - Tracking: ${label.tracking_number}`,
//             },
//           });

//           fulfillmentResults.push({
//             sku: orderItem.productVariant.sku,
//             quantityFulfilled: quantityToFulfill,
//             location: inventory.location.name,
//             newAvailable:
//               updatedInventory.quantityOnHand -
//               updatedInventory.quantityReserved,
//           });

//           remainingQuantity -= quantityToFulfill;
//         }

//         if (remainingQuantity > 0) {
//           console.warn(
//             `⚠️ Could not fulfill ${remainingQuantity} units of ${orderItem.productVariant.sku}`
//           );
//         }
//       }

//       // Update order to DELIVERED
//       // Update order to FULFILLED
//       const finalOrder = await tx.order.update({
//         where: { id: orderId },
//         // data: { status: "DELIVERED" },
//         data: { status: "FULFILLED" },
//       });

//       return { order: finalOrder, fulfillmentResults };
//     });

//     console.log("✅ Inventory fulfilled");

//     // Step 4: Update Shopify (optional)
//     let shopifyResult = null;
//     if (order.shopifyOrderId) {
//       try {
//         console.log("🛍️ Updating Shopify...");
//         shopifyResult = await updateShopifyFulfillment({
//           orderId: order.shopifyOrderId,
//           trackingNumber: label.tracking_number,
//           trackingCompany: carrierCode || "USPS",
//           lineItems: order.items.map((item) => ({
//             id: item.id,
//             sku: item.productVariant.sku,
//             quantity: item.quantity,
//           })),
//         });
//         console.log("✅ Shopify updated");
//       } catch (error) {
//         console.warn("⚠️ Shopify update failed:", error);
//         // Don't fail the whole process if Shopify update fails
//       }
//     }

//     console.log("🎉 Order fulfillment complete!");

//     return NextResponse.json({
//       success: true,
//       order: fulfillmentResult.order,
//       label: {
//         id: label.label_id,
//         trackingNumber: label.tracking_number,
//         cost: label.shipment_cost.amount,
//         labelUrl: label.label_download.href,
//       },
//       inventory: fulfillmentResult.fulfillmentResults,
//       shopify: shopifyResult,
//       message: `Order ${order.orderNumber} completed successfully`,
//       addressUsed: customerAddress, // Show what address was actually used
//     });
//   } catch (error) {
//     console.error("❌ Complete order error:", error);

//     const errorMessage =
//       error instanceof Error ? error.message : "Failed to complete order";

//     return NextResponse.json({ error: errorMessage }, { status: 500 });
//   }
// }
