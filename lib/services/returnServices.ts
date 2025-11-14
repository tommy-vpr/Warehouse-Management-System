// lib/services/returnService.ts
// Core business logic for Return Management System

import { PrismaClient } from "@prisma/client";
import {
  ReturnStatus,
  ReturnReason,
  ReturnCondition,
  ReturnDisposition,
  RefundMethod,
  ReturnEventType,
  TransactionType,
} from "@prisma/client";
import {
  CreateReturnRequest,
  OrderLookupRequest,
  OrderLookupResponse,
  ReturnEligibility,
  DEFAULT_RETURN_POLICY,
  InspectItemRequest,
  InspectionSummary,
  RefundCalculation,
} from "@/types/returns";

const prisma = new PrismaClient();

// ============================================================================
// RETURN ORDER LOOKUP & ELIGIBILITY
// ============================================================================

export async function lookupOrderForReturn(
  request: OrderLookupRequest
): Promise<OrderLookupResponse> {
  const { orderNumber, customerEmail } = request;

  // Find order
  const order = await prisma.order.findUnique({
    where: { orderNumber },
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
      returns: {
        where: {
          status: {
            not: "CANCELLED",
          },
        },
        include: {
          items: true,
        },
      },
    },
  });

  if (!order) {
    return {
      success: false,
      order: null,
      eligibility: {
        isEligible: false,
        reason: "Order not found",
      },
    };
  }

  // Verify email matches
  if (order.customerEmail?.toLowerCase() !== customerEmail.toLowerCase()) {
    return {
      success: false,
      order: null,
      eligibility: {
        isEligible: false,
        reason: "Email does not match order",
      },
      error: "Email verification failed",
    };
  }

  // Check eligibility
  const eligibility = checkReturnEligibility(order);

  if (!eligibility.isEligible) {
    return {
      success: false,
      order: null,
      eligibility,
      error: eligibility.reason,
    };
  }

  // Calculate available return quantities
  const existingReturns = order.returns || [];
  const returnedQuantities = new Map<string, number>();

  existingReturns.forEach((ret) => {
    ret.items.forEach((item) => {
      const current = returnedQuantities.get(item.productVariantId) || 0;
      returnedQuantities.set(
        item.productVariantId,
        current + item.quantityRequested
      );
    });
  });

  // Transform order items for response
  const items = order.items.map((item) => {
    const quantityReturned = returnedQuantities.get(item.productVariantId) || 0;
    const quantityAvailable = item.quantity - quantityReturned;

    return {
      id: item.id,
      productVariantId: item.productVariantId,
      sku: item.productVariant.sku,
      name: item.productVariant.name,
      quantity: item.quantity,
      quantityReturned,
      quantityAvailable,
      unitPrice: Number(item.unitPrice),
      imageUrl: undefined, // TODO: Add product image URL
    };
  });

  return {
    success: true,
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerEmail: order.customerEmail || "",
      shippedAt: order.shippedAt,
      items: items.filter((item) => item.quantityAvailable > 0), // Only show returnable items
    },
    eligibility,
  };
}

function checkReturnEligibility(order: any): ReturnEligibility {
  const policy = DEFAULT_RETURN_POLICY;

  // Check order status
  if (!policy.allowedStatuses.includes(order.status)) {
    return {
      isEligible: false,
      reason: `Order status "${order.status}" is not eligible for returns`,
      returnWindow: policy.returnWindowDays,
      shippedDate: order.shippedAt,
    };
  }

  // Check if order was shipped
  if (!order.shippedAt) {
    return {
      isEligible: false,
      reason: "Order has not been shipped yet",
      returnWindow: policy.returnWindowDays,
      shippedDate: null,
    };
  }

  // Check return window
  const daysSinceShipped = Math.floor(
    (Date.now() - new Date(order.shippedAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceShipped > policy.returnWindowDays) {
    return {
      isEligible: false,
      reason: `Return window expired (${policy.returnWindowDays} days from shipment)`,
      returnWindow: policy.returnWindowDays,
      shippedDate: order.shippedAt,
    };
  }

  const daysRemaining = policy.returnWindowDays - daysSinceShipped;

  return {
    isEligible: true,
    daysRemaining,
    returnWindow: policy.returnWindowDays,
    shippedDate: order.shippedAt,
  };
}

// ============================================================================
// CREATE RETURN (RMA)
// ============================================================================

export async function createReturn(
  request: CreateReturnRequest,
  userId?: string
) {
  const { orderId, customerEmail, reason, reasonDetails, refundMethod, items } =
    request;

  // Verify order and email
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          productVariant: true,
        },
      },
    },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  if (order.customerEmail?.toLowerCase() !== customerEmail.toLowerCase()) {
    throw new Error("Email verification failed");
  }

  // Validate quantities
  for (const item of items) {
    const orderItem = order.items.find(
      (oi) => oi.productVariantId === item.productVariantId
    );

    if (!orderItem) {
      throw new Error(
        `Product variant ${item.productVariantId} not found in order`
      );
    }

    // Check for existing returns
    const existingReturns = await prisma.returnItem.findMany({
      where: {
        returnOrder: {
          orderId,
          status: {
            not: "CANCELLED",
          },
        },
        productVariantId: item.productVariantId,
      },
    });

    const totalReturned = existingReturns.reduce(
      (sum, r) => sum + r.quantityRequested,
      0
    );

    if (totalReturned + item.quantityRequested > orderItem.quantity) {
      throw new Error(
        `Cannot return ${item.quantityRequested} of ${
          orderItem.productVariant.name
        }. Only ${orderItem.quantity - totalReturned} available.`
      );
    }
  }

  // Generate RMA number
  const rmaNumber = await generateRMANumber();

  // Calculate if approval is required
  const totalAmount = items.reduce((sum, item) => {
    const orderItem = order.items.find(
      (oi) => oi.productVariantId === item.productVariantId
    )!;
    return sum + Number(orderItem.unitPrice) * item.quantityRequested;
  }, 0);

  const approvalRequired =
    totalAmount >= DEFAULT_RETURN_POLICY.autoApproveThreshold ||
    items.reduce((sum, item) => sum + item.quantityRequested, 0) > 10;

  // Create return order
  const returnOrder = await prisma.returnOrder.create({
    data: {
      rmaNumber,
      orderId,
      customerName: order.customerName,
      customerEmail: order.customerEmail || "",
      status: approvalRequired ? ReturnStatus.PENDING : ReturnStatus.APPROVED,
      reason,
      reasonDetails,
      refundMethod,
      approvalRequired,
      items: {
        create: items.map((item) => {
          const orderItem = order.items.find(
            (oi) => oi.productVariantId === item.productVariantId
          )!;
          return {
            productVariantId: item.productVariantId,
            quantityRequested: item.quantityRequested,
            orderItemId: orderItem.id,
            unitPrice: orderItem.unitPrice,
            refundAmount: Number(orderItem.unitPrice) * item.quantityRequested,
            status: "PENDING",
          };
        }),
      },
      events: {
        create: {
          eventType: ReturnEventType.RMA_CREATED,
          userId: userId || "CUSTOMER",
          data: {
            reason,
            reasonDetails,
            totalAmount,
            approvalRequired,
          },
        },
      },
    },
    include: {
      items: {
        include: {
          productVariant: true,
        },
      },
    },
  });

  // Send notifications
  await sendReturnNotification({
    type: "RMA_CREATED",
    returnOrderId: returnOrder.id,
    rmaNumber: returnOrder.rmaNumber,
    recipientEmail: order.customerEmail || undefined,
    data: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      items: returnOrder.items,
      approvalRequired,
    },
    priority: "NORMAL",
  });

  if (approvalRequired) {
    // Notify manager for approval
    await sendReturnNotification({
      type: "HIGH_VALUE_RETURN",
      returnOrderId: returnOrder.id,
      rmaNumber: returnOrder.rmaNumber,
      data: {
        totalAmount,
        customerName: order.customerName,
        orderNumber: order.orderNumber,
      },
      priority: "HIGH",
    });
  }

  return {
    success: true,
    returnOrder: {
      id: returnOrder.id,
      rmaNumber: returnOrder.rmaNumber,
      status: returnOrder.status,
      approvalRequired: returnOrder.approvalRequired,
    },
  };
}

async function generateRMANumber(): Promise<string> {
  const year = new Date().getFullYear();
  const lastReturn = await prisma.returnOrder.findFirst({
    where: {
      rmaNumber: {
        startsWith: `RMA-${year}`,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  let sequence = 1;
  if (lastReturn) {
    const lastSequence = parseInt(lastReturn.rmaNumber.split("-")[2]);
    sequence = lastSequence + 1;
  }

  return `RMA-${year}-${sequence.toString().padStart(4, "0")}`;
}

// ============================================================================
// RECEIVE RETURN
// ============================================================================

export async function receiveReturn(
  rmaNumber: string,
  userId: string,
  trackingNumber?: string
) {
  const returnOrder = await prisma.returnOrder.findUnique({
    where: { rmaNumber },
  });

  if (!returnOrder) {
    throw new Error("Return not found");
  }

  if (
    returnOrder.status !== ReturnStatus.APPROVED &&
    returnOrder.status !== ReturnStatus.IN_TRANSIT
  ) {
    throw new Error(`Cannot receive return with status ${returnOrder.status}`);
  }

  // Update return order
  const updated = await prisma.returnOrder.update({
    where: { rmaNumber },
    data: {
      status: ReturnStatus.RECEIVED,
      receivedAt: new Date(),
      receivedBy: userId,
      returnTrackingNumber: trackingNumber || returnOrder.returnTrackingNumber,
      events: {
        create: {
          eventType: ReturnEventType.PACKAGE_RECEIVED,
          userId,
          data: {
            trackingNumber,
          },
        },
      },
    },
    include: {
      items: {
        include: {
          productVariant: true,
        },
      },
    },
  });

  // Notify inspection team
  await sendReturnNotification({
    type: "PACKAGE_RECEIVED",
    returnOrderId: updated.id,
    rmaNumber: updated.rmaNumber,
    data: {
      items: updated.items,
    },
    priority: "NORMAL",
  });

  return updated;
}

// ============================================================================
// INSPECTION
// ============================================================================

export async function inspectReturnItem(
  request: InspectItemRequest,
  userId: string
) {
  const {
    returnItemId,
    quantityReceived,
    condition,
    conditionNotes,
    disposition,
    dispositionNotes,
    restockLocationId,
    photoUrls = [],
  } = request;

  const returnItem = await prisma.returnItem.findUnique({
    where: { id: returnItemId },
    include: {
      returnOrder: true,
      productVariant: true,
    },
  });

  if (!returnItem) {
    throw new Error("Return item not found");
  }

  // Validate quantities
  if (quantityReceived > returnItem.quantityRequested) {
    throw new Error("Received quantity cannot exceed requested quantity");
  }

  // Calculate refund based on condition
  const baseRefund = Number(returnItem.unitPrice) * quantityReceived;
  const refundRate = calculateRefundRate(
    condition,
    returnItem.returnOrder.reason
  );
  const refundAmount = baseRefund * refundRate;

  // Determine quantities for restock vs dispose
  let quantityRestockable = 0;
  let quantityDisposed = 0;

  if (disposition === ReturnDisposition.RESTOCK) {
    quantityRestockable = quantityReceived;
  } else if (disposition === ReturnDisposition.DISPOSE) {
    quantityDisposed = quantityReceived;
  }
  // For other dispositions, we may handle differently

  // Update return item
  const updatedItem = await prisma.returnItem.update({
    where: { id: returnItemId },
    data: {
      quantityReceived,
      quantityRestockable,
      quantityDisposed,
      status: "INSPECTED",
    },
  });

  // Create inspection record
  const inspection = await prisma.returnInspection.create({
    data: {
      returnOrderId: returnItem.returnOrderId,
      returnItemId: returnItem.id,
      condition,
      conditionNotes,
      disposition,
      dispositionNotes,
      restockLocationId:
        disposition === ReturnDisposition.RESTOCK ? restockLocationId : null,
      inspectedBy: userId,
      photoUrls,
    },
  });

  // Create return event
  await prisma.returnEvent.create({
    data: {
      returnOrderId: returnItem.returnOrderId,
      eventType: ReturnEventType.ITEM_INSPECTED,
      userId,
      data: {
        returnItemId,
        sku: returnItem.productVariant.sku,
        quantityReceived,
        condition,
        disposition,
        refundAmount,
      },
    },
  });

  // Check if all items inspected
  await checkInspectionComplete(returnItem.returnOrderId);

  return {
    updatedItem,
    inspection,
    refundAmount,
  };
}

function calculateRefundRate(
  condition: ReturnCondition,
  reason: ReturnReason
): number {
  const policy = DEFAULT_RETURN_POLICY;

  // Full refund for defective or wrong items
  if (
    reason === ReturnReason.DEFECTIVE ||
    reason === ReturnReason.WRONG_ITEM ||
    reason === ReturnReason.DAMAGED_SHIPPING
  ) {
    return 1.0;
  }

  // Apply condition-based rates
  return policy.conditionRefundRates[condition] || 0.5;
}

async function checkInspectionComplete(returnOrderId: string) {
  const returnOrder = await prisma.returnOrder.findUnique({
    where: { id: returnOrderId },
    include: {
      items: true,
    },
  });

  if (!returnOrder) return;

  const allInspected = returnOrder.items.every(
    (item) => item.status === "INSPECTED"
  );

  if (allInspected) {
    await prisma.returnOrder.update({
      where: { id: returnOrderId },
      data: {
        status: ReturnStatus.INSPECTION_COMPLETE,
        inspectedAt: new Date(),
        events: {
          create: {
            eventType: ReturnEventType.INSPECTION_COMPLETED,
            userId: returnOrder.inspectedBy || "SYSTEM",
          },
        },
      },
    });

    // Notify for refund processing
    await sendReturnNotification({
      type: "INSPECTION_COMPLETE",
      returnOrderId: returnOrder.id,
      rmaNumber: returnOrder.rmaNumber,
      data: {
        customerEmail: returnOrder.customerEmail,
      },
      priority: "NORMAL",
    });
  }
}

// ============================================================================
// RESTOCKING
// ============================================================================

export async function restockReturnedItems(
  returnOrderId: string,
  userId: string
) {
  const returnOrder = await prisma.returnOrder.findUnique({
    where: { id: returnOrderId },
    include: {
      items: {
        include: {
          productVariant: true,
          inspections: {
            where: {
              disposition: ReturnDisposition.RESTOCK,
            },
          },
        },
      },
    },
  });

  if (!returnOrder) {
    throw new Error("Return order not found");
  }

  if (returnOrder.status !== ReturnStatus.INSPECTION_COMPLETE) {
    throw new Error("Cannot restock before inspection is complete");
  }

  // Process each restockable item
  for (const item of returnOrder.items) {
    if (item.quantityRestockable > 0) {
      const inspection = item.inspections[0];

      if (!inspection || !inspection.restockLocationId) {
        throw new Error(
          `No restock location specified for ${item.productVariant.sku}`
        );
      }

      // Update inventory
      await prisma.inventory.upsert({
        where: {
          productVariantId_locationId: {
            productVariantId: item.productVariantId,
            locationId: inspection.restockLocationId,
          },
        },
        create: {
          productVariantId: item.productVariantId,
          locationId: inspection.restockLocationId,
          quantityOnHand: item.quantityRestockable,
        },
        update: {
          quantityOnHand: {
            increment: item.quantityRestockable,
          },
        },
      });

      // Create inventory transaction
      await prisma.inventoryTransaction.create({
        data: {
          productVariantId: item.productVariantId,
          locationId: inspection.restockLocationId,
          transactionType: TransactionType.RETURNS,
          quantityChange: item.quantityRestockable,
          userId,
          referenceId: returnOrder.id,
          referenceType: "RETURN_ORDER",
          notes: `Restocked from RMA ${returnOrder.rmaNumber}`,
        },
      });

      // Update item status
      await prisma.returnItem.update({
        where: { id: item.id },
        data: {
          status: "RESTOCKED",
        },
      });

      // Create event
      await prisma.returnEvent.create({
        data: {
          returnOrderId: returnOrder.id,
          eventType: ReturnEventType.ITEM_RESTOCKED,
          userId,
          data: {
            sku: item.productVariant.sku,
            quantity: item.quantityRestockable,
            locationId: inspection.restockLocationId,
          },
        },
      });
    }
  }

  // Update return order status
  await prisma.returnOrder.update({
    where: { id: returnOrderId },
    data: {
      status: ReturnStatus.RESTOCKING,
    },
  });

  return { success: true };
}

// ============================================================================
// REFUND PROCESSING
// ============================================================================

export async function calculateRefund(
  returnOrderId: string
): Promise<RefundCalculation> {
  const returnOrder = await prisma.returnOrder.findUnique({
    where: { id: returnOrderId },
    include: {
      items: {
        include: {
          productVariant: true,
          inspections: true,
        },
      },
    },
  });

  if (!returnOrder) {
    throw new Error("Return order not found");
  }

  const itemRefunds = returnOrder.items.map((item) => {
    const baseAmount = Number(item.unitPrice) * item.quantityReceived;
    const inspection = item.inspections[0];

    if (!inspection) {
      return {
        returnItemId: item.id,
        sku: item.productVariant.sku,
        baseAmount,
        conditionDeduction: 0,
        finalAmount: 0,
      };
    }

    const refundRate = calculateRefundRate(
      inspection.condition,
      returnOrder.reason
    );
    const finalAmount = baseAmount * refundRate;
    const conditionDeduction = baseAmount - finalAmount;

    return {
      returnItemId: item.id,
      sku: item.productVariant.sku,
      baseAmount,
      conditionDeduction,
      finalAmount,
    };
  });

  const subtotal = itemRefunds.reduce((sum, item) => sum + item.finalAmount, 0);

  // Calculate restocking fee (only if not defective/wrong item)
  let restockingFee = 0;
  if (
    returnOrder.reason !== ReturnReason.DEFECTIVE &&
    returnOrder.reason !== ReturnReason.WRONG_ITEM &&
    returnOrder.reason !== ReturnReason.DAMAGED_SHIPPING
  ) {
    restockingFee =
      subtotal * (DEFAULT_RETURN_POLICY.restockingFeePercent / 100);
  }

  // Shipping refund (only for defective/wrong items)
  let shippingRefund = 0;
  // TODO: Get original shipping cost from order

  const finalRefundAmount = subtotal - restockingFee + shippingRefund;

  return {
    itemRefunds,
    subtotal,
    restockingFee,
    adjustments: 0,
    shippingRefund,
    finalRefundAmount,
  };
}

export async function processRefund(returnOrderId: string, userId: string) {
  const returnOrder = await prisma.returnOrder.findUnique({
    where: { id: returnOrderId },
    include: {
      order: true,
      items: true,
    },
  });

  if (!returnOrder) {
    throw new Error("Return order not found");
  }

  // Calculate refund
  const refundCalc = await calculateRefund(returnOrderId);

  // Serialize the refund calculation for JSON storage
  const refundBreakdown = {
    itemRefunds: refundCalc.itemRefunds,
    subtotal: refundCalc.subtotal,
    restockingFee: refundCalc.restockingFee,
    adjustments: refundCalc.adjustments,
    shippingRefund: refundCalc.shippingRefund,
    finalRefundAmount: refundCalc.finalRefundAmount,
  };

  // Update return order
  await prisma.returnOrder.update({
    where: { id: returnOrderId },
    data: {
      refundAmount: refundCalc.finalRefundAmount,
      refundStatus: "PROCESSING",
      restockingFee: refundCalc.restockingFee,
      events: {
        create: {
          eventType: ReturnEventType.REFUND_INITIATED,
          userId,
          data: {
            refundAmount: refundCalc.finalRefundAmount,
            breakdown: refundBreakdown,
          },
        },
      },
    },
  });

  // TODO: Integrate with Shopify refund API
  // For now, mark as pending Shopify sync
  await prisma.returnOrder.update({
    where: { id: returnOrderId },
    data: {
      shopifySyncStatus: "PENDING",
    },
  });

  return {
    success: true,
    refundAmount: refundCalc.finalRefundAmount,
    breakdown: refundCalc,
  };
}

// ============================================================================
// NOTIFICATIONS (Placeholder)
// ============================================================================

async function sendReturnNotification(notification: any) {
  // TODO: Implement with your notification system (Ably, email, etc.)
  console.log("Return notification:", notification);
}

// ============================================================================
// EXPORTS
// ============================================================================

export const returnService = {
  lookupOrderForReturn,
  createReturn,
  receiveReturn,
  inspectReturnItem,
  restockReturnedItems,
  calculateRefund,
  processRefund,
};
