// lib/audit-helper.ts
import { prisma } from "@/lib/prisma";
import { OrderStatus } from "@prisma/client";

/**
 * Track order reassignment events
 */
export async function trackOrderReassignment(params: {
  orderId: string;
  fromUserId: string | null;
  toUserId: string;
  stage: OrderStatus;
  userId: string; // Who made the reassignment
  notes?: string;
}) {
  const { orderId, fromUserId, toUserId, stage, userId, notes } = params;

  const fromUser = fromUserId
    ? await prisma.user.findUnique({ where: { id: fromUserId } })
    : null;
  const toUser = await prisma.user.findUnique({ where: { id: toUserId } });

  const statusNote = `${stage} reassigned from ${
    fromUser?.name || "Unassigned"
  } to ${toUser?.name || toUserId}${notes ? ` - ${notes}` : ""}`;

  await prisma.orderStatusHistory.create({
    data: {
      orderId,
      previousStatus: stage,
      newStatus: stage,
      notes: statusNote,
      changedBy: userId,
    },
  });
}

/**
 * Track pick list wave changes
 */
export async function trackPickListWaveChange(params: {
  orderId: string;
  fromBatchNumber: string | null;
  toBatchNumber: string;
  userId: string;
  notes?: string;
}) {
  const { orderId, fromBatchNumber, toBatchNumber, userId, notes } = params;

  await prisma.orderStatusHistory.create({
    data: {
      orderId,
      previousStatus: "PICKING" as OrderStatus,
      newStatus: "PICKING" as OrderStatus,
      notes: `Pick list wave changed from ${
        fromBatchNumber || "None"
      } to ${toBatchNumber}${notes ? ` - ${notes}` : ""}`,
      changedBy: userId,
    },
  });
}

/**
 * Track packing task changes
 */
export async function trackPackingTaskChange(params: {
  orderId: string;
  fromTaskNumber: string | null;
  toTaskNumber: string;
  userId: string;
  notes?: string;
}) {
  const { orderId, fromTaskNumber, toTaskNumber, userId, notes } = params;

  await prisma.orderStatusHistory.create({
    data: {
      orderId,
      previousStatus: "PACKING" as OrderStatus,
      newStatus: "PACKING" as OrderStatus,
      notes: `Packing task changed from ${
        fromTaskNumber || "None"
      } to ${toTaskNumber}${notes ? ` - ${notes}` : ""}`,
      changedBy: userId,
    },
  });
}

/**
 * Track priority changes
 */
export async function trackPriorityChange(params: {
  orderId: string;
  fromPriority: string;
  toPriority: string;
  currentStatus: OrderStatus;
  userId: string;
  notes?: string;
}) {
  const { orderId, fromPriority, toPriority, currentStatus, userId, notes } =
    params;

  await prisma.orderStatusHistory.create({
    data: {
      orderId,
      previousStatus: currentStatus,
      newStatus: currentStatus,
      notes: `Priority changed from ${fromPriority} to ${toPriority}${
        notes ? ` - ${notes}` : ""
      }`,
      changedBy: userId,
    },
  });
}

/**
 * Track manual adjustments
 */
export async function trackManualAdjustment(params: {
  orderId: string;
  action: string;
  description: string;
  currentStatus: OrderStatus;
  userId: string;
}) {
  const { orderId, action, description, currentStatus, userId } = params;

  await prisma.orderStatusHistory.create({
    data: {
      orderId,
      previousStatus: currentStatus,
      newStatus: currentStatus,
      notes: `${action}: ${description}`,
      changedBy: userId,
    },
  });
}

/**
 * Track order notes/comments
 */
export async function trackOrderComment(params: {
  orderId: string;
  comment: string;
  currentStatus: OrderStatus;
  userId: string;
}) {
  const { orderId, comment, currentStatus, userId } = params;

  await prisma.orderStatusHistory.create({
    data: {
      orderId,
      previousStatus: currentStatus,
      newStatus: currentStatus,
      notes: comment,
      changedBy: userId,
    },
  });
}
