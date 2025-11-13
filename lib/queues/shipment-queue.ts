import { Queue, QueueEvents } from "bullmq";
import { Redis } from "ioredis";

// ===================================================================
// REDIS CONNECTION (Singleton)
// ===================================================================

let redisConnection: Redis | null = null;

export function getRedisConnection(): Redis {
  if (!redisConnection) {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      throw new Error("REDIS_URL environment variable is not set");
    }

    console.log("🔌 Creating Redis connection...");

    redisConnection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      enableOfflineQueue: true,
      connectTimeout: 15000,
      retryStrategy: (times) => {
        if (times > 10) {
          console.error("❌ Max Redis retries reached");
          return null;
        }
        const delay = Math.min(times * 1000, 5000);
        console.log(`⏳ Redis retry ${times}, waiting ${delay}ms`);
        return delay;
      },
    });

    redisConnection.on("connect", () => {
      console.log("✅ Redis connected");
    });

    redisConnection.on("ready", () => {
      console.log("✅ Redis ready");
    });

    redisConnection.on("error", (err) => {
      console.error("❌ Redis error:", err.message);
    });

    redisConnection.on("close", () => {
      console.log("🔌 Redis connection closed");
    });

    redisConnection.on("reconnecting", () => {
      console.log("🔄 Redis reconnecting...");
    });
  }

  return redisConnection;
}

export async function closeRedisConnection() {
  if (redisConnection) {
    console.log("Closing Redis connection...");
    await redisConnection.quit();
    redisConnection = null;
  }
}

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
// CREATE QUEUE
// ===================================================================

const connection = getRedisConnection();

export const shipmentQueue = new Queue("shipment-processing", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 3600,
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600,
    },
  },
});

export const queueEvents = new QueueEvents("shipment-processing", {
  connection,
});

// ===================================================================
// JOB CREATORS
// ===================================================================

export async function queuePackingSlipGeneration(
  orderId: string,
  packageIds: string[],
  orderNumber: string
) {
  console.log(`📋 Queueing packing slips for ${orderNumber}`);

  return shipmentQueue.add(
    "generate-packing-slips",
    { orderId, packageIds, orderNumber } as PackingSlipJob,
    {
      priority: 2,
      jobId: `packing-slip-${orderId}-${Date.now()}`,
    }
  );
}

export async function queueShopifyFulfillment(data: ShopifyFulfillmentJob) {
  console.log(`📋 Queueing Shopify fulfillment for ${data.shopifyOrderId}`);

  return shipmentQueue.add("shopify-fulfillment", data, {
    priority: 3,
    attempts: 5,
    jobId: `shopify-${data.orderId}-${Date.now()}`,
  });
}

export async function queueShipmentNotification(data: NotificationJob) {
  console.log(`📋 Queueing notification for ${data.orderNumber}`);

  return shipmentQueue.add("send-notification", data, {
    priority: 3,
    delay: 3000,
    jobId: `notification-${data.orderId}-${data.type}-${Date.now()}`,
  });
}

// ===================================================================
// UTILITIES
// ===================================================================

export async function getQueueStats() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    shipmentQueue.getWaitingCount(),
    shipmentQueue.getActiveCount(),
    shipmentQueue.getCompletedCount(),
    shipmentQueue.getFailedCount(),
    shipmentQueue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}
