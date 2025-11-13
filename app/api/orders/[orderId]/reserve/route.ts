// import { NextRequest, NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";
// import { getServerSession } from "next-auth";
// import { authOptions } from "@/lib/auth";

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

//     // Get the order with items
//     const order = await prisma.order.findUnique({
//       where: { id: orderId },
//       include: {
//         items: {
//           include: {
//             productVariant: {
//               include: {
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

//     if (order.status !== "PENDING") {
//       return NextResponse.json(
//         { error: "Order must be in PENDING status to reserve inventory" },
//         { status: 400 }
//       );
//     }

//     const result = await prisma.$transaction(async (tx) => {
//       const reservations = [];

//       for (const item of order.items) {
//         let remainingQuantity = item.quantity;

//         // Sort inventory by available quantity descending
//         const inventoryLocations = item.productVariant.inventory
//           .map((inv) => ({
//             ...inv,
//             quantityAvailable: inv.quantityOnHand - inv.quantityReserved,
//           }))
//           .filter((inv) => inv.quantityAvailable > 0)
//           .sort((a, b) => b.quantityAvailable - a.quantityAvailable);

//         for (const inventory of inventoryLocations) {
//           if (remainingQuantity <= 0) break;

//           const quantityToReserve = Math.min(
//             remainingQuantity,
//             inventory.quantityAvailable
//           );

//           // Reserve inventory
//           await tx.inventory.update({
//             where: {
//               productVariantId_locationId: {
//                 productVariantId: item.productVariantId,
//                 locationId: inventory.locationId,
//               },
//             },
//             data: {
//               quantityReserved: {
//                 increment: quantityToReserve,
//               },
//             },
//           });

//           // Create transaction record
//           await tx.inventoryTransaction.create({
//             data: {
//               productVariantId: item.productVariantId,
//               locationId: inventory.locationId,
//               transactionType: "ALLOCATION",
//               quantityChange: -quantityToReserve,
//               referenceId: orderId,
//               referenceType: "ORDER",
//               userId: session?.user?.id,
//               notes: `Auto-reserved ${quantityToReserve} units for order ${order.orderNumber}`,
//             },
//           });

//           reservations.push({
//             productVariantId: item.productVariantId,
//             locationId: inventory.locationId,
//             quantity: quantityToReserve,
//             sku: item.productVariant.sku,
//           });

//           remainingQuantity -= quantityToReserve;
//         }

//         if (remainingQuantity > 0) {
//           throw new Error(
//             `Insufficient inventory for SKU ${item.productVariant.sku}. Short by ${remainingQuantity} units.`
//           );
//         }
//       }

//       // Update order status
//       const updatedOrder = await tx.order.update({
//         where: { id: orderId },
//         data: { status: "ALLOCATED" },
//       });

//       return {
//         order: updatedOrder,
//         reservations,
//       };
//     });

//     return NextResponse.json(result);
//   } catch (error) {
//     console.error("Error reserving order inventory:", error);

//     const errorMessage =
//       error instanceof Error
//         ? error.message
//         : "Failed to reserve order inventory";

//     return NextResponse.json({ error: errorMessage }, { status: 500 });
//   }
// }
