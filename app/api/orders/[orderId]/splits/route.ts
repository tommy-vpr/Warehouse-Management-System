// import { NextRequest, NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";
// import { getServerSession } from "next-auth";
// import { authOptions } from "@/lib/auth";

// export async function GET(
//   request: NextRequest,
//   { params }: { params: { id: string } }
// ) {
//   try {
//     const session = await getServerSession(authOptions);
//     if (!session?.user?.id) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     const orderId = params.id;

//     // Get original order with items and any existing splits
//     const order = await prisma.order.findUnique({
//       where: { id: orderId },
//       include: {
//         items: {
//           include: {
//             productVariant: {
//               include: { product: true },
//             },
//           },
//         },
//         // Note: You'll need to add the splits relation to your Order model
//         // splits: {
//         //   include: {
//         //     items: {
//         //       include: {
//         //         productVariant: {
//         //           include: { product: true }
//         //         }
//         //       }
//         //     },
//         //     packages: true
//         //   }
//         // }
//       },
//     });

//     if (!order) {
//       return NextResponse.json({ error: "Order not found" }, { status: 404 });
//     }

//     return NextResponse.json({
//       order,
//       canSplit: order.status === "PENDING" || order.status === "ALLOCATED",
//       // totalSplits: order.splits?.length || 0
//     });
//   } catch (error) {
//     console.error("Error fetching order splits:", error);
//     return NextResponse.json(
//       { error: "Failed to fetch order splits" },
//       { status: 500 }
//     );
//   }
// }

// export async function POST(
//   request: NextRequest,
//   { params }: { params: { id: string } }
// ) {
//   try {
//     const session = await getServerSession(authOptions);
//     if (!session?.user?.id) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     const orderId = params.id;
//     const { splits } = await request.json();

//     // Validate splits structure
//     if (!splits || !Array.isArray(splits) || splits.length === 0) {
//       return NextResponse.json(
//         { error: "Invalid splits data" },
//         { status: 400 }
//       );
//     }

//     // Get original order
//     const order = await prisma.order.findUnique({
//       where: { id: orderId },
//       include: {
//         items: {
//           include: {
//             productVariant: true,
//           },
//         },
//       },
//     });

//     if (!order) {
//       return NextResponse.json({ error: "Order not found" }, { status: 404 });
//     }

//     if (order.status !== "PENDING" && order.status !== "ALLOCATED") {
//       return NextResponse.json(
//         { error: "Order cannot be split in current status" },
//         { status: 400 }
//       );
//     }

//     // Validate split quantities match original quantities
//     const originalQuantities = new Map();
//     order.items.forEach((item) => {
//       originalQuantities.set(item.productVariantId, item.quantity);
//     });

//     const splitQuantities = new Map();
//     splits.forEach((split: any) => {
//       split.items.forEach((item: any) => {
//         const current = splitQuantities.get(item.productVariantId) || 0;
//         splitQuantities.set(item.productVariantId, current + item.quantity);
//       });
//     });

//     // Check quantities match
//     for (const [variantId, originalQty] of originalQuantities) {
//       const splitQty = splitQuantities.get(variantId) || 0;
//       if (splitQty !== originalQty) {
//         return NextResponse.json(
//           {
//             error: `Quantity mismatch for variant ${variantId}: original ${originalQty}, split total ${splitQty}`,
//           },
//           { status: 400 }
//         );
//       }
//     }

//     // For now, since you don't have OrderSplit model yet, let's create a simpler version
//     // that just creates multiple orders from the original order

//     const result = await prisma.$transaction(async (tx) => {
//       const createdSplits = [];

//       for (let i = 0; i < splits.length; i++) {
//         const splitData = splits[i];

//         // Calculate split total
//         const splitTotal = splitData.items.reduce((sum: number, item: any) => {
//           const originalItem = order.items.find(
//             (oi) => oi.productVariantId === item.productVariantId
//           );
//           return (
//             sum +
//             (originalItem
//               ? parseFloat(originalItem.unitPrice.toString()) * item.quantity
//               : 0)
//           );
//         }, 0);

//         // Create new order for this split
//         const splitOrder = await tx.order.create({
//           data: {
//             orderNumber: `${order.orderNumber}-${i + 1}`,
//             customerName: order.customerName,
//             customerEmail: order.customerEmail,
//             status: "PENDING",
//             totalAmount: splitTotal,
//             shippingAddress: order.shippingAddress,
//             billingAddress: order.billingAddress,
//             notes: `Split ${i + 1} of ${splits.length} from original order ${
//               order.orderNumber
//             }`,
//             items: {
//               create: splitData.items
//                 .filter((item: any) => item.quantity > 0)
//                 .map((item: any) => {
//                   const originalItem = order.items.find(
//                     (oi) => oi.productVariantId === item.productVariantId
//                   );
//                   return {
//                     productVariantId: item.productVariantId,
//                     quantity: item.quantity,
//                     unitPrice: originalItem?.unitPrice || 0,
//                     totalPrice: originalItem
//                       ? parseFloat(originalItem.unitPrice.toString()) *
//                         item.quantity
//                       : 0,
//                   };
//                 }),
//             },
//           },
//           include: {
//             items: {
//               include: {
//                 productVariant: {
//                   include: { product: true },
//                 },
//               },
//             },
//           },
//         });

//         createdSplits.push(splitOrder);
//       }

//       // Update original order status
//       await tx.order.update({
//         where: { id: orderId },
//         data: {
//           status: "CANCELLED", // Mark original as cancelled since we created new split orders
//           notes: `Original order cancelled - split into ${
//             splits.length
//           } separate orders: ${createdSplits
//             .map((s) => s.orderNumber)
//             .join(", ")}`,
//         },
//       });

//       return createdSplits;
//     });

//     return NextResponse.json({
//       success: true,
//       splits: result,
//       message: `Order split into ${result.length} separate orders`,
//     });
//   } catch (error) {
//     console.error("Error creating order splits:", error);
//     return NextResponse.json(
//       { error: "Failed to create order splits" },
//       { status: 500 }
//     );
//   }
// }
