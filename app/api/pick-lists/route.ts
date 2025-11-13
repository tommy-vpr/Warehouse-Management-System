// app/api/pick-lists/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyUser } from "@/lib/ably-server";
import { reserveOrderInventory } from "@/lib/reserveInventory";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { orderIds, assignedTo, priority } = body;

    // Validation
    if (!orderIds || orderIds.length === 0) {
      return NextResponse.json(
        { error: "No orders selected" },
        { status: 400 }
      );
    }

    if (!assignedTo) {
      return NextResponse.json(
        { error: "Staff member not selected" },
        { status: 400 }
      );
    }

    // ✅ STEP 1: Get orders
    const orders = await prisma.order.findMany({
      where: {
        id: { in: orderIds },
        status: { in: ["ALLOCATED", "PENDING"] },
      },
      include: {
        items: {
          include: {
            productVariant: {
              include: {
                inventory: {
                  where: { quantityOnHand: { gt: 0 } },
                  include: { location: true },
                  orderBy: { quantityOnHand: "desc" },
                },
              },
            },
          },
        },
      },
    });

    if (orders.length === 0) {
      return NextResponse.json(
        { error: "No valid orders found for picking" },
        { status: 400 }
      );
    }

    // ✅ STEP 2: Auto-allocate PENDING orders only
    const pendingOrders = orders.filter((o) => o.status === "PENDING");

    if (pendingOrders.length > 0) {
      console.log(
        `📦 Auto-allocating ${pendingOrders.length} pending order(s)...`
      );

      for (const order of pendingOrders) {
        try {
          // ✅ Use your existing reserveOrderInventory function
          const result = await reserveOrderInventory({
            orderId: order.id,
            userId: session.user.id,
            handleInsufficientInventory: "throw", // Fail if not enough inventory
            notes: "Auto-allocated during pick list creation",
          });

          if (!result.success) {
            throw new Error(
              `Insufficient inventory for order ${order.orderNumber}`
            );
          }

          // ✅ Update order status to ALLOCATED
          await prisma.order.update({
            where: { id: order.id },
            data: {
              status: "ALLOCATED",
              currentStage: "PICKING",
            },
          });

          // ✅ Create status history
          await prisma.orderStatusHistory.create({
            data: {
              orderId: order.id,
              previousStatus: "PENDING",
              newStatus: "ALLOCATED",
              changedBy: session.user.id,
              changedAt: new Date(),
              notes: `Auto-allocated during pick list creation - ${result.reservations.length} location(s)`,
            },
          });

          console.log(
            `✅ Allocated order ${order.orderNumber} - ${result.reservations.length} reservations created`
          );
        } catch (error) {
          console.error(
            `❌ Failed to allocate order ${order.orderNumber}:`,
            error
          );
          throw new Error(
            `Cannot create pick list - failed to allocate order ${
              order.orderNumber
            }: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }
      }
    }

    // ✅ STEP 3: Create pick list items
    const pickListItems: any[] = [];
    let sequence = 1;

    for (const order of orders) {
      for (const orderItem of order.items) {
        let remainingQty = orderItem.quantity;
        const inventoryLocations = orderItem.productVariant.inventory.filter(
          (inv) => inv.quantityOnHand > 0
        );

        for (const inventory of inventoryLocations) {
          if (remainingQty <= 0) break;

          const qtyFromLocation = Math.min(
            remainingQty,
            inventory.quantityOnHand
          );

          pickListItems.push({
            orderId: order.id,
            orderItemId: orderItem.id,
            productVariantId: orderItem.productVariantId,
            locationId: inventory.locationId,
            quantityToPick: qtyFromLocation,
            quantityPicked: 0,
            pickSequence: sequence++,
            status: "PENDING",
          });

          remainingQty -= qtyFromLocation;
        }

        if (remainingQty > 0) {
          console.warn(
            `⚠️ Short on inventory for ${orderItem.productVariant.sku}: ${remainingQty} units short`
          );
        }
      }
    }

    const batchNumber = `PICK-${Date.now().toString().slice(-6)}`;

    // ✅ STEP 4: Create pick list in transaction
    const pickList = await prisma.$transaction(async (tx) => {
      const list = await tx.pickList.create({
        data: {
          batchNumber,
          status: "ASSIGNED",
          assignedTo,
          priority: priority || 0,
          totalItems: pickListItems.length,
          pickedItems: 0,
        },
      });

      await tx.pickListItem.createMany({
        data: pickListItems.map((item) => ({
          ...item,
          pickListId: list.id,
        })),
      });

      const createdItemCount = await tx.pickListItem.count({
        where: { pickListId: list.id },
      });

      if (createdItemCount !== pickListItems.length) {
        throw new Error(
          `Failed to create all pick list items. Expected ${pickListItems.length}, got ${createdItemCount}`
        );
      }

      await tx.pickEvent.create({
        data: {
          pickListId: list.id,
          eventType: "PICK_STARTED",
          userId: session.user.id,
          notes: `Pick list created with ${pickListItems.length} items from ${orders.length} order(s)`,
        },
      });

      console.log(
        `✅ Created pick list ${batchNumber} with ${createdItemCount} items`
      );

      return tx.pickList.findUnique({
        where: { id: list.id },
        include: {
          items: {
            include: {
              order: {
                select: { id: true, orderNumber: true, customerName: true },
              },
              productVariant: {
                select: { id: true, sku: true, name: true },
              },
              location: {
                select: { id: true, name: true },
              },
            },
          },
          assignedUser: {
            select: { id: true, name: true, email: true },
          },
        },
      });
    });

    // ✅ STEP 5: Update all orders to PICKING
    await prisma.order.updateMany({
      where: { id: { in: orderIds } },
      data: {
        status: "PICKING",
        currentStage: "PICKING",
        pickingAssignedTo: assignedTo,
        pickingAssignedAt: new Date(),
      },
    });

    // ✅ STEP 6: Create status history for all orders
    for (const orderId of orderIds) {
      await prisma.orderStatusHistory.create({
        data: {
          orderId,
          previousStatus: "ALLOCATED",
          newStatus: "PICKING",
          changedBy: session.user.id,
          changedAt: new Date(),
          notes: `Pick list ${batchNumber} generated`,
        },
      });
    }

    // ✅ STEP 7: Send notification
    try {
      const assignedUser = pickList?.assignedUser;
      const assignedByName =
        session.user.name || session.user.email || "Manager";

      if (pickList) {
        await notifyUser(assignedTo, {
          type: "PICK_LIST_ASSIGNED",
          title: "New Pick List Assigned",
          message: `You've been assigned pick list ${pickList.batchNumber} with ${pickList.totalItems} items by ${assignedByName}.`,
          link: `/dashboard/picking/mobile/${pickList.id}`,
          metadata: {
            pickListId: pickList.id,
            batchNumber: pickList.batchNumber,
            totalItems: pickList.totalItems,
            totalOrders: orderIds.length,
            assignedBy: assignedByName,
            assignedAt: new Date().toISOString(),
            priority: priority || 0,
            orders: pickList.items
              .map((item) => ({
                orderId: item.order.id,
                orderNumber: item.order.orderNumber,
                customerName: item.order.customerName,
              }))
              .filter(
                (order, index, self) =>
                  index === self.findIndex((o) => o.orderId === order.orderId)
              ),
          },
        });

        console.log(
          `✅ Pick list notification sent to ${
            assignedUser?.name || assignedUser?.email
          }`
        );
      }
    } catch (notificationError) {
      console.error(
        "❌ Failed to send pick list notification:",
        notificationError
      );
    }

    return NextResponse.json(pickList, { status: 201 });
  } catch (error) {
    console.error("❌ Error creating pick list:", error);
    return NextResponse.json(
      {
        error: "Failed to create pick list",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// export async function POST(req: NextRequest) {
//   try {
//     const session = await getServerSession(authOptions);
//     if (!session?.user?.id) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     const body = await req.json();
//     const { orderIds, assignedTo, priority } = body;

//     // Validation
//     if (!orderIds || orderIds.length === 0) {
//       return NextResponse.json(
//         { error: "No orders selected" },
//         { status: 400 }
//       );
//     }

//     if (!assignedTo) {
//       return NextResponse.json(
//         { error: "Staff member not selected" },
//         { status: 400 }
//       );
//     }

//     // Get orders with their items and inventory allocations
//     const orders = await prisma.order.findMany({
//       where: {
//         id: { in: orderIds },
//         status: { in: ["ALLOCATED", "PENDING"] },
//       },
//       include: {
//         items: {
//           include: {
//             productVariant: {
//               include: {
//                 inventory: {
//                   where: {
//                     quantityOnHand: { gt: 0 },
//                   },
//                   include: {
//                     location: true,
//                   },
//                   orderBy: {
//                     quantityOnHand: "desc",
//                   },
//                 },
//               },
//             },
//           },
//         },
//       },
//     });

//     if (orders.length === 0) {
//       return NextResponse.json(
//         { error: "No valid orders found for picking" },
//         { status: 400 }
//       );
//     }

//     // Create pick list items with optimal location routing
//     const pickListItems: any[] = [];
//     let sequence = 1;

//     for (const order of orders) {
//       for (const orderItem of order.items) {
//         let remainingQty = orderItem.quantity;

//         // Find inventory locations for this product
//         const inventoryLocations = orderItem.productVariant.inventory.filter(
//           (inv) => inv.quantityOnHand > 0
//         );

//         for (const inventory of inventoryLocations) {
//           if (remainingQty <= 0) break;

//           const qtyFromLocation = Math.min(
//             remainingQty,
//             inventory.quantityOnHand
//           );

//           pickListItems.push({
//             orderId: order.id,
//             orderItemId: orderItem.id,
//             productVariantId: orderItem.productVariantId,
//             locationId: inventory.locationId,
//             quantityToPick: qtyFromLocation,
//             quantityPicked: 0,
//             pickSequence: sequence++,
//             status: "PENDING",
//           });

//           remainingQty -= qtyFromLocation;
//         }

//         // If still short, log warning
//         if (remainingQty > 0) {
//           console.warn(
//             `⚠️ Short on inventory for ${orderItem.productVariant.sku}: ${remainingQty} units short`
//           );
//         }
//       }
//     }

//     // Generate batch number
//     const batchNumber = `PICK-${Date.now().toString().slice(-6)}`;

//     // Create pick list in transaction
//     const pickList = await prisma.$transaction(async (tx) => {
//       const list = await tx.pickList.create({
//         data: {
//           batchNumber,
//           status: "ASSIGNED",
//           assignedTo,
//           priority: priority || 0,
//           totalItems: pickListItems.length,
//           pickedItems: 0,
//         },
//       });

//       // Create pick list items
//       await tx.pickListItem.createMany({
//         data: pickListItems.map((item) => ({
//           ...item,
//           pickListId: list.id,
//         })),
//       });

//       // Validate items were created
//       const createdItemCount = await tx.pickListItem.count({
//         where: { pickListId: list.id },
//       });

//       if (createdItemCount !== pickListItems.length) {
//         throw new Error(
//           `Failed to create all pick list items. Expected ${pickListItems.length}, got ${createdItemCount}`
//         );
//       }

//       // Create pick event
//       await tx.pickEvent.create({
//         data: {
//           pickListId: list.id,
//           eventType: "PICK_STARTED",
//           userId: session.user.id,
//           notes: `Pick list created with ${pickListItems.length} items from ${orders.length} order(s)`,
//         },
//       });

//       console.log(
//         `✅ Created pick list ${batchNumber} with ${createdItemCount} items`
//       );

//       return tx.pickList.findUnique({
//         where: { id: list.id },
//         include: {
//           items: {
//             include: {
//               order: {
//                 select: {
//                   id: true,
//                   orderNumber: true,
//                   customerName: true,
//                 },
//               },
//               productVariant: {
//                 select: {
//                   id: true,
//                   sku: true,
//                   name: true,
//                 },
//               },
//               location: {
//                 select: {
//                   id: true,
//                   name: true,
//                 },
//               },
//             },
//           },
//           assignedUser: {
//             select: {
//               id: true,
//               name: true,
//               email: true,
//             },
//           },
//         },
//       });
//     });

//     // Update order statuses AFTER successful pick list creation
//     await prisma.order.updateMany({
//       where: { id: { in: orderIds } },
//       data: {
//         status: "PICKING",
//         currentStage: "PICKING",
//         pickingAssignedTo: assignedTo,
//         pickingAssignedAt: new Date(),
//       },
//     });

//     // Send notification to assigned user
//     try {
//       const assignedUser = pickList?.assignedUser;
//       const assignedByName =
//         session.user.name || session.user.email || "Manager";

//       if (pickList) {
//         await notifyUser(assignedTo, {
//           type: "PICK_LIST_ASSIGNED",
//           title: "New Pick List Assigned",
//           message: `You've been assigned pick list ${pickList.batchNumber} with ${pickList.totalItems} items by ${assignedByName}.`,
//           link: `/dashboard/picking/mobile/${pickList.id}`,
//           metadata: {
//             pickListId: pickList.id,
//             batchNumber: pickList.batchNumber,
//             totalItems: pickList.totalItems,
//             totalOrders: orderIds.length,
//             assignedBy: assignedByName,
//             assignedAt: new Date().toISOString(),
//             priority: priority || 0,
//             orders: pickList.items
//               .map((item) => ({
//                 orderId: item.order.id,
//                 orderNumber: item.order.orderNumber,
//                 customerName: item.order.customerName,
//               }))
//               .filter(
//                 (order, index, self) =>
//                   index === self.findIndex((o) => o.orderId === order.orderId)
//               ),
//           },
//         });

//         console.log(
//           `✅ Pick list notification sent to ${
//             assignedUser?.name || assignedUser?.email
//           }`
//         );
//       }
//     } catch (notificationError) {
//       console.error(
//         "❌ Failed to send pick list notification:",
//         notificationError
//       );
//     }

//     return NextResponse.json(pickList, { status: 201 });
//   } catch (error) {
//     console.error("❌ Error creating pick list:", error);
//     return NextResponse.json(
//       {
//         error: "Failed to create pick list",
//         details: error instanceof Error ? error.message : "Unknown error",
//       },
//       { status: 500 }
//     );
//   }
// }

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (status && status !== "ALL") {
      // Handle multiple statuses (comma-separated)
      const statuses = status.split(",");
      where.status = statuses.length === 1 ? status : { in: statuses };
    }

    // Get total count
    const totalCount = await prisma.pickList.count({ where });
    const totalPages = Math.ceil(totalCount / limit);

    // Fetch pick lists with pagination
    const pickLists = await prisma.pickList.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: {
          select: {
            id: true,
            quantityToPick: true,
            quantityPicked: true,
            status: true,
          },
        },
      },
    });

    // Calculate metrics for each pick list
    const enrichedPickLists = pickLists.map((pickList) => {
      const totalItems = pickList.items.reduce(
        (sum, item) => sum + item.quantityToPick,
        0
      );
      const pickedItems = pickList.items.reduce(
        (sum, item) => sum + item.quantityPicked,
        0
      );
      const completionRate =
        totalItems > 0 ? Math.round((pickedItems / totalItems) * 100) : 0;
      const itemsRemaining = totalItems - pickedItems;

      return {
        id: pickList.id,
        batchNumber: pickList.batchNumber,
        status: pickList.status,
        assignedTo: pickList.assignedTo,
        totalItems,
        pickedItems,
        completionRate,
        itemsRemaining,
        createdAt: pickList.createdAt.toISOString(),
        updatedAt: pickList.updatedAt.toISOString(),
        assignedUser: pickList.assignedUser,
      };
    });

    return NextResponse.json({
      pickLists: enrichedPickLists,
      totalPages,
      currentPage: page,
      totalCount,
    });
  } catch (error) {
    console.error("Error fetching pick lists:", error);
    return NextResponse.json(
      { error: "Failed to fetch pick lists" },
      { status: 500 }
    );
  }
}
