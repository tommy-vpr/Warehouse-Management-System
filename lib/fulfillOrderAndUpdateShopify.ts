// lib/fulfillOrderAndUpdateShopify.ts
import { prisma } from "@/lib/prisma";

import {
  updateShopifyFulfillment,
  getShopifyCarrierName,
} from "@/lib/shopify-fulfillment";

export async function fulfillOrderAndUpdateShopify(
  orderId: string,
  userId: string
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          productVariant: {
            select: { sku: true, name: true, shopifyVariantId: true },
          },
        },
      },
    },
  });
  if (!order) throw new Error("Order not found");

  if (!["SHIPPED", "PARTIALLY_SHIPPED"].includes(order.status)) {
    throw new Error("Order must be shipped before marking as fulfilled");
  }

  if (!order.shopifyOrderId) {
    return {
      success: true,
      order,
      message: "Order fulfilled (non-Shopify order)",
    };
  }

  const pendingSync = await prisma.shopifySync.findFirst({
    where: { orderId, syncType: "FULFILLMENT", status: "PENDING" },
  });

  // Retry pending Shopify sync
  if (pendingSync) {
    console.log("🔁 Retrying pending Shopify sync...");
    try {
      const { trackingNumber, trackingUrl, carrier, items } =
        pendingSync.data as any;
      const result = await updateShopifyFulfillment({
        orderId: order.shopifyOrderId!,
        trackingNumbers: trackingNumber ? [trackingNumber] : [],
        trackingUrls: trackingUrl ? [trackingUrl] : [],
        trackingCompany: getShopifyCarrierName(carrier),
        lineItems: items,
        notifyCustomer: true,
      });

      await prisma.shopifySync.update({
        where: { id: pendingSync.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });

      await prisma.order.update({
        where: { id: order.id },
        data: {
          shopifyFulfillmentIds: order.shopifyFulfillmentIds
            ? `${order.shopifyFulfillmentIds},${result.fulfillmentId}`
            : result.fulfillmentId,
        },
      });

      return {
        success: true,
        order,
        message: `Shopify fulfillment retried successfully: ${result.fulfillmentId}`,
      };
    } catch (err) {
      console.error("⚠️ Shopify retry failed:", err);
      return { success: false, order, error: err, message: "Retry failed." };
    }
  }

  // If already synced
  if (order.shopifyFulfillmentIds) {
    return {
      success: true,
      order,
      message: `Order already fulfilled on Shopify (${order.shopifyFulfillmentIds})`,
    };
  }

  return {
    success: true,
    order,
    message: "Order fulfilled locally. No Shopify fulfillment detected.",
  };
}
