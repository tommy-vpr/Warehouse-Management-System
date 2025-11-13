import { Worker, Job } from "bullmq";
import { prisma } from "@/lib/prisma";
import {
  getRedisConnection,
  closeRedisConnection,
  PackingSlipJob,
  ShopifyFulfillmentJob,
  NotificationJob,
} from "@/lib/queues/shipment-queue";

import { generatePackingSlipsForOrder } from "@/lib/packing-slip-generator";
import {
  updateShopifyFulfillment,
  getShopifyCarrierName,
} from "@/lib/shopify-fulfillment";
import { sendNotification, notifyUser } from "@/lib/ably-server";

const connection = getRedisConnection();

console.log("🚀 Starting shipment worker...");

// ================================================================
// WORKER DEFINITION
// ================================================================

export const shipmentWorker = new Worker(
  "shipment-processing",
  async (job: Job) => {
    const startTime = Date.now();
    console.log(`🔄 [${job.id}] ${job.name}`);

    try {
      switch (job.name) {
        case "generate-packing-slips":
          await processPackingSlips(job.data as PackingSlipJob);
          break;

        case "shopify-fulfillment":
          await processShopifyFulfillment(job.data as ShopifyFulfillmentJob);
          break;

        case "send-notification":
          await processSendNotification(job.data as NotificationJob);
          break;

        default:
          console.warn(`⚠️ Unknown job type: ${job.name}`);
      }

      console.log(`✅ [${job.id}] Done in ${Date.now() - startTime}ms`);
    } catch (error) {
      console.error(`❌ [${job.id}] Failed:`, error);
      throw error;
    }
  },
  {
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || "5"),
    connection,
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
);

// ================================================================
// JOB PROCESSORS
// ================================================================

async function processPackingSlips(data: PackingSlipJob) {
  const { orderId, orderNumber } = data;

  console.log(`📄 Generating packing slips for ${orderNumber}`);

  const packingSlips = await generatePackingSlipsForOrder(orderId);

  await sendNotification(`order:${orderId}`, "update", {
    type: "packing_slips_ready",
    orderId,
    orderNumber,
    packingSlips,
    timestamp: new Date().toISOString(),
  });
}

async function processShopifyFulfillment(data: ShopifyFulfillmentJob) {
  const {
    orderId,
    shopifyOrderId,
    trackingNumbers,
    trackingUrls,
    carrier,
    lineItems,
    isBackOrder,
  } = data;

  console.log(`🛍️ Shopify fulfillment for ${shopifyOrderId}`);

  try {
    const result = await updateShopifyFulfillment({
      orderId: shopifyOrderId,
      trackingNumbers,
      trackingUrls:
        trackingUrls ??
        trackingNumbers.map(
          (n: string) =>
            `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`
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

    await sendNotification(`order:${orderId}`, "update", {
      type: "shopify_fulfilled",
      orderId,
      fulfillmentId: result.fulfillmentId,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error(`⚠️ Shopify fulfillment error:`, error);

    await prisma.shopifySync.create({
      data: {
        orderId,
        syncType: "FULFILLMENT",
        status: "PENDING",
        attempts: 0,
        data: { trackingNumbers, carrier, lineItems, isBackOrder },
        error: error?.message || "Unknown error",
      },
    });

    throw error;
  }
}

async function processSendNotification(data: NotificationJob) {
  const { orderId, orderNumber, userId, type, trackingNumbers } = data;

  console.log(`📧 Sending ${type} notification for ${orderNumber}`);

  try {
    await notifyUser(userId!, {
      type: "ORDER_UPDATE",
      title: `Order ${orderNumber} Shipped`,
      message: `Order shipped! Tracking: ${trackingNumbers?.join(", ")}`,
      link: `/dashboard/orders/${orderId}`,
      metadata: { orderId, orderNumber, type, trackingNumbers },
    });

    await sendNotification(`order:${orderId}`, "update", {
      type: "notification_sent",
      orderId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error(`❌ Notification failed`, err);
  }
}

// ================================================================
// SHUTDOWN HANDLING
// ================================================================

const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received — shutting down worker`);

  try {
    await shipmentWorker.close();
    await closeRedisConnection();
    process.exit(0);
  } catch (err) {
    console.error("🔥 Error shutting down worker", err);
    process.exit(1);
  }
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

console.log(
  `✅ Shipment worker ready (Concurrency: ${
    process.env.WORKER_CONCURRENCY || 5
  })`
);
