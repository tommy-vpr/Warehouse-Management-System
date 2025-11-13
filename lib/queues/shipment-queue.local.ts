import { prisma } from "@/lib/prisma";
import { generatePackingSlipsForOrder } from "@/lib/packing-slip-generator";
import {
  updateShopifyFulfillment,
  getShopifyCarrierName,
} from "@/lib/shopify-fulfillment";
import { sendNotification, notifyUser } from "@/lib/ably-server";

// ===================================================================
// JOB TYPE DEFINITIONS
// ===================================================================

export interface PackingSlipJob {
  orderId: string;
  packageIds: string[];
  orderNumber: string;
}

export interface ShopifyFulfillmentJob {
  orderId: string;
  shopifyOrderId: string;
  trackingNumbers: string[];
  trackingUrls?: string[];
  carrier: string;
  lineItems: Array<{
    variantId?: string;
    sku: string;
    quantity: number;
  }>;
  isBackOrder: boolean;
}

export interface NotificationJob {
  orderId: string;
  orderNumber: string;
  userId?: string;
  customerEmail: string;
  type: "shipped" | "packed" | "label_created";
  trackingNumbers?: string[];
}

// ===================================================================
// IN-MEMORY PROCESSOR (No Redis needed for local dev!)
// ===================================================================

class LocalQueueProcessor {
  async processPackingSlips(data: PackingSlipJob) {
    const { orderId, orderNumber } = data;
    console.log(`📄 [LOCAL] Generating packing slips for ${orderNumber}`);

    try {
      const packingSlips = await generatePackingSlipsForOrder(orderId);
      console.log(
        `✅ [LOCAL] Generated ${packingSlips.length} packing slip(s)`
      );

      // Send real-time update via Ably
      await sendNotification(`order:${orderId}`, "update", {
        type: "packing_slips_ready",
        orderId,
        orderNumber,
        packingSlips,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`❌ [LOCAL] Packing slip generation failed:`, error);
    }
  }

  async processShopifyFulfillment(data: ShopifyFulfillmentJob) {
    const {
      orderId,
      shopifyOrderId,
      trackingNumbers,
      trackingUrls,
      carrier,
      lineItems,
      isBackOrder,
    } = data;

    console.log(`🛍️  [LOCAL] Shopify fulfillment for ${shopifyOrderId}`);

    try {
      const result = await updateShopifyFulfillment({
        orderId: shopifyOrderId,
        trackingNumbers,
        trackingUrls:
          trackingUrls ||
          trackingNumbers.map(
            (n) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`
          ),
        trackingCompany: getShopifyCarrierName(carrier),
        lineItems,
        notifyCustomer: true,
        isBackOrder,
      });

      await prisma.order.update({
        where: { id: orderId },
        data: { shopifyFulfillmentIds: result.fulfillmentId },
      });

      console.log(`✅ [LOCAL] Shopify fulfillment: ${result.fulfillmentId}`);

      await sendNotification(`order:${orderId}`, "update", {
        type: "shopify_fulfilled",
        orderId,
        fulfillmentId: result.fulfillmentId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`⚠️  [LOCAL] Shopify failed:`, error);

      // Create sync task for retry
      await prisma.shopifySync.create({
        data: {
          orderId,
          syncType: "FULFILLMENT",
          status: "PENDING",
          attempts: 0,
          data: { trackingNumbers, carrier, lineItems },
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  }

  async processSendNotification(data: NotificationJob) {
    const { orderId, orderNumber, userId, type, trackingNumbers } = data;

    console.log(`📧 [LOCAL] Sending ${type} notification for ${orderNumber}`);

    try {
      const notificationData = {
        type: "ORDER_UPDATE",
        title: `Order ${orderNumber} Shipped`,
        message: `Order shipped! Tracking: ${trackingNumbers?.join(", ")}`,
        link: `/dashboard/orders/${orderId}`,
        metadata: { orderId, orderNumber, type, trackingNumbers },
      };

      if (userId) {
        await notifyUser(userId, notificationData);
        console.log(`✅ [LOCAL] Notified user ${userId}`);
      }

      await sendNotification(`order:${orderId}`, "update", {
        type: "notification_sent",
        orderId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`❌ [LOCAL] Notification failed:`, error);
    }
  }
}

const processor = new LocalQueueProcessor();

// ===================================================================
// QUEUE FUNCTIONS (Process with setTimeout to simulate async)
// ===================================================================

export async function queuePackingSlipGeneration(
  orderId: string,
  packageIds: string[],
  orderNumber: string
) {
  console.log(`📋 [LOCAL] Queueing packing slips for ${orderNumber}`);

  // Process in background (1s delay simulates queue)
  setTimeout(async () => {
    await processor.processPackingSlips({ orderId, packageIds, orderNumber });
  }, 1000);

  return Promise.resolve();
}

export async function queueShopifyFulfillment(data: ShopifyFulfillmentJob) {
  console.log(
    `📋 [LOCAL] Queueing Shopify fulfillment for ${data.shopifyOrderId}`
  );

  // Process in background (2s delay)
  setTimeout(async () => {
    await processor.processShopifyFulfillment(data);
  }, 2000);

  return Promise.resolve();
}

export async function queueShipmentNotification(data: NotificationJob) {
  console.log(`📋 [LOCAL] Queueing notification for ${data.orderNumber}`);

  // Process in background (3s delay)
  setTimeout(async () => {
    await processor.processSendNotification(data);
  }, 3000);

  return Promise.resolve();
}

// ===================================================================
// UTILITIES (Mock implementations)
// ===================================================================

export async function getQueueStats() {
  return {
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
  };
}

export function getRedisConnection() {
  throw new Error("Redis not available in local mode");
}

export async function closeRedisConnection() {
  console.log("[LOCAL] No Redis to close");
}
