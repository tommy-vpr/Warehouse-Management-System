// app/api/pick-lists/[id]/reassign/route.ts
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import type { ReassignmentReason } from "@/types/audit-trail";
import { notifyUser } from "@/lib/ably-server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, name: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.role !== "ADMIN" && user.role !== "MANAGER") {
      return NextResponse.json(
        {
          error:
            "Insufficient permissions. Only ADMIN and MANAGER roles can reassign pick lists.",
        },
        { status: 403 }
      );
    }

    const managerName = user.name || session.user.email || "Unknown Manager";

    const { id: pickListId } = await params;
    const body = await req.json();
    const {
      newStaffId,
      strategy = "split",
      reason = "OTHER" as ReassignmentReason,
      notes,
    } = body;

    if (!newStaffId) {
      return NextResponse.json(
        { error: "Missing required field: newStaffId" },
        { status: 400 }
      );
    }

    // Get current pick list with full details
    const pickList = await prisma.pickList.findUnique({
      where: { id: pickListId },
      include: {
        items: {
          include: {
            productVariant: { include: { product: true } },
            location: true,
            order: true,
          },
        },
        assignedUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!pickList) {
      return NextResponse.json(
        { error: "Pick list not found" },
        { status: 404 }
      );
    }

    // Get new assignee
    const newUser = await prisma.user.findUnique({
      where: { id: newStaffId },
      select: { id: true, name: true, email: true },
    });

    if (!newUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check for partial completion
    const partialItems = pickList.items.filter(
      (item) =>
        item.quantityPicked > 0 && item.quantityPicked < item.quantityToPick
    );

    const unpickedItems = pickList.items.filter(
      (item) => item.quantityPicked === 0
    );

    if (partialItems.length === 0 && unpickedItems.length === 0) {
      return NextResponse.json(
        { error: "Nothing to reassign - pick list is complete" },
        { status: 400 }
      );
    }

    let result;

    if (strategy === "split") {
      // Strategy 1: Create new pick list for remainder
      result = await createContinuationPickList(
        pickList,
        partialItems,
        unpickedItems,
        newStaffId,
        newUser,
        session.user.id,
        managerName,
        reason,
        notes
      );
    } else {
      // Strategy 2: Simple reassignment
      result = await simpleReassignment(
        pickList,
        newStaffId,
        newUser,
        session.user.id,
        managerName,
        reason,
        notes
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Pick list reassignment error:", error);
    return NextResponse.json(
      {
        error: "Failed to reassign pick list",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

async function createContinuationPickList(
  originalList: any,
  partialItems: any[],
  unpickedItems: any[],
  newStaffId: string,
  newUser: any,
  managerId: string,
  managerName: string,
  reason: ReassignmentReason,
  notes?: string
) {
  return await prisma.$transaction(async (tx) => {
    const remainingWork = [];

    // Handle partially picked items
    for (const item of partialItems) {
      const remainingQty = item.quantityToPick - item.quantityPicked;

      // Update original item to reflect completed portion
      await tx.pickListItem.update({
        where: { id: item.id },
        data: {
          quantityToPick: item.quantityPicked,
          status: "PICKED",
          pickedAt: new Date(),
        },
      });

      // Add remainder to new list
      remainingWork.push({
        orderId: item.orderId,
        productVariantId: item.productVariantId,
        locationId: item.locationId,
        quantityToPick: remainingQty,
        pickSequence: item.pickSequence,
        notes: `Continuation from ${originalList.batchNumber}`,
      });
    }

    // Add completely unpicked items
    for (const item of unpickedItems) {
      remainingWork.push({
        orderId: item.orderId,
        productVariantId: item.productVariantId,
        locationId: item.locationId,
        quantityToPick: item.quantityToPick,
        pickSequence: item.pickSequence,
        notes: `Moved from ${originalList.batchNumber}`,
      });
    }

    // Create continuation pick list
    const continuationList = await tx.pickList.create({
      data: {
        batchNumber: `${originalList.batchNumber}-CONT`,
        assignedTo: newStaffId,
        status: "ASSIGNED",
        priority: originalList.priority + 1,
        totalItems: remainingWork.length,
        parentPickListId: originalList.id,
        notes: `Continuation of ${originalList.batchNumber}`,
        items: {
          create: remainingWork,
        },
      },
      include: {
        items: {
          include: {
            productVariant: { include: { product: true } },
            location: true,
            order: true,
          },
        },
        assignedUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Mark original as partially completed
    await tx.pickList.update({
      where: { id: originalList.id },
      data: {
        status: "PARTIALLY_COMPLETED",
        endTime: new Date(),
        notes: `Partially completed - continued in ${continuationList.batchNumber}`,
      },
    });

    // 🎯 CREATE SPLIT EVENT (for original list)
    await tx.pickEvent.create({
      data: {
        pickListId: originalList.id,
        eventType: "PICK_SPLIT",
        userId: managerId,
        notes:
          notes ||
          `Pick list split - ${partialItems.length} partial items, ${unpickedItems.length} unpicked items`,
        data: {
          continuationListId: continuationList.id,
          continuationBatchNumber: continuationList.batchNumber,
          fromUserId: originalList.assignedTo,
          fromUserName: originalList.assignedUser?.name,
          toUserId: newStaffId,
          toUserName: newUser.name,
          reason,
          timestamp: new Date().toISOString(),
          reassignedBy: managerId,
          reassignedByName: managerName,
          partialItemsSplit: partialItems.length,
          unpickedItemsMoved: unpickedItems.length,
        },
      },
    });

    await notifyUser(newStaffId, {
      type: "PICK_LIST_ASSIGNED",
      title: "Continuation Pick List Assigned",
      message: `You’ve been assigned a continuation pick list ${continuationList.batchNumber} (from ${originalList.batchNumber}) by ${managerName}.`,
      link: `/dashboard/picking/mobile/${continuationList.id}`,
      metadata: {
        continuationOf: originalList.batchNumber,
        reassignedBy: managerName,
        reason,
      },
    });

    // 🎯 CREATE ASSIGNMENT EVENT (for new continuation list)
    await tx.pickEvent.create({
      data: {
        pickListId: continuationList.id,
        eventType: "PICK_REASSIGNED",
        userId: newStaffId,
        notes: `Assigned continuation from ${originalList.batchNumber}`,
        data: {
          originalListId: originalList.id,
          originalBatchNumber: originalList.batchNumber,
          reason,
          assignedBy: managerId,
          assignedByName: managerName,
        },
      },
    });

    return {
      success: true,
      original: {
        id: originalList.id,
        batchNumber: originalList.batchNumber,
        status: "PARTIALLY_COMPLETED",
      },
      continuation: {
        id: continuationList.id,
        batchNumber: continuationList.batchNumber,
        assignedTo: newStaffId,
        assignedToUser: continuationList.assignedUser,
      },
      summary: {
        partialItemsSplit: partialItems.length,
        unpickedItemsMoved: unpickedItems.length,
        totalItemsInContinuation: remainingWork.length,
      },
    };
  });
}

async function simpleReassignment(
  originalList: any,
  newStaffId: string,
  newUser: any,
  managerId: string,
  managerName: string,
  reason: ReassignmentReason,
  notes?: string
) {
  return await prisma.$transaction(async (tx) => {
    // Calculate progress
    const totalItems = originalList.items.length;
    const pickedItems = originalList.items.filter(
      (item: any) => item.status === "PICKED"
    ).length;

    // Update pick list
    const updated = await tx.pickList.update({
      where: { id: originalList.id },
      data: {
        assignedTo: newStaffId,
        status: pickedItems === 0 ? "ASSIGNED" : "IN_PROGRESS",
      },
      include: {
        assignedUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // 🎯 CREATE REASSIGNMENT EVENT
    await tx.pickEvent.create({
      data: {
        pickListId: originalList.id,
        eventType: "PICK_REASSIGNED",
        userId: managerId,
        notes:
          notes ||
          `Reassigned from ${originalList.assignedUser?.name} to ${newUser.name}`,
        data: {
          fromUserId: originalList.assignedTo,
          fromUserName: originalList.assignedUser?.name,
          toUserId: newStaffId,
          toUserName: newUser.name,
          reason,
          timestamp: new Date().toISOString(),
          reassignedBy: managerId,
          reassignedByName: managerName,
          progress: {
            completedItems: pickedItems,
            totalItems,
          },
        },
      },
    });

    // 🔔 Notify reassigned user
    await notifyUser(newStaffId, {
      type: "PICK_LIST_ASSIGNED",
      title: "New Pick List Assigned",
      message: `You’ve been assigned pick list ${originalList.batchNumber} by ${managerName}.`,
      link: `/dashboard/picking/mobile/${originalList.id}`,
      metadata: {
        reassignedBy: managerName,
        reason,
      },
    });

    return {
      success: true,
      pickList: {
        id: updated.id,
        batchNumber: updated.batchNumber,
        assignedTo: updated.assignedTo || "",
        assignedToUser: updated.assignedUser,
      },
    };
  });
}
