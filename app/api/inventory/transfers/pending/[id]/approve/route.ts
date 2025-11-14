import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notifyUser } from "@/lib/ably-server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✅ Enforce ADMIN MANAGER only
    const role = session.user?.role;

    if (!role || !["ADMIN", "MANAGER"].includes(role)) {
      return NextResponse.json(
        { error: "Forbidden: Approved by admin or manager only" },
        { status: 403 }
      );
    }

    const { notes } = await request.json();
    const { id } = await params;

    const result = await prisma.$transaction(async (tx) => {
      // Get pending transfer
      const transfer = await tx.inventoryTransaction.findUnique({
        where: {
          id,
          referenceType: "TRANSFER_PENDING",
        },
        include: {
          productVariant: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!transfer) {
        throw new Error("Transfer not found");
      }

      const metadata = transfer.metadata as any;

      // Verify confirmer
      if (metadata.confirmerId !== session.user.id) {
        throw new Error("Not authorized to confirm this transfer");
      }

      // Verify status
      if (metadata.status !== "PENDING") {
        throw new Error("Transfer already processed");
      }

      const quantity = Math.abs(metadata.quantity);

      // Update from location (decrease quantity)
      await tx.inventory.update({
        where: {
          productVariantId_locationId: {
            productVariantId: transfer.productVariantId,
            locationId: metadata.fromLocationId,
          },
        },
        data: {
          quantityOnHand: { decrement: quantity },
        },
      });

      // Update to location (increase quantity or create if doesn't exist)
      await tx.inventory.upsert({
        where: {
          productVariantId_locationId: {
            productVariantId: transfer.productVariantId,
            locationId: metadata.toLocationId,
          },
        },
        update: {
          quantityOnHand: { increment: quantity },
        },
        create: {
          productVariantId: transfer.productVariantId,
          locationId: metadata.toLocationId,
          quantityOnHand: quantity,
        },
      });

      // Update transfer status
      const updatedTransfer = await tx.inventoryTransaction.update({
        where: { id },
        data: {
          quantityChange: quantity,
          referenceType: "TRANSFER_APPROVED",
          notes: `APPROVED: ${notes || "Transfer approved"}`,
          metadata: {
            ...metadata,
            status: "APPROVED",
            approvedBy: session.user.id,
            approvedAt: new Date().toISOString(),
            approvalNotes: notes,
          },
        },
      });

      // Create completion transaction records
      await tx.inventoryTransaction.create({
        data: {
          productVariantId: transfer.productVariantId,
          transactionType: "TRANSFER",
          quantityChange: -quantity,
          locationId: metadata.fromLocationId,
          referenceType: "TRANSFER_OUT",
          referenceId: id,
          userId: session.user.id,
          notes: `Transfer to ${metadata.toLocationName}`,
        },
      });

      await tx.inventoryTransaction.create({
        data: {
          productVariantId: transfer.productVariantId,
          transactionType: "TRANSFER",
          quantityChange: quantity,
          locationId: metadata.toLocationId,
          referenceType: "TRANSFER_IN",
          referenceId: id,
          userId: session.user.id,
          notes: `Transfer from ${metadata.fromLocationName}`,
        },
      });

      // Notify requester
      await notifyUser(metadata.requestedBy, {
        type: "TRANSFER_APPROVED",
        title: "Transfer Approved",
        message: `Your transfer of ${quantity} ${metadata.productName} has been approved`,
        // link: `/dashboard/inventory/product/${transfer.productVariantId}`,
        link: `/dashboard/inventory/transfers/${id}`,
        timestamp: new Date().toISOString(),
      });

      await tx.notification.create({
        data: {
          userId: metadata.requestedBy,
          type: "TRANSFER_APPROVED",
          title: "Transfer Approved",
          message: `Your transfer of ${quantity} ${metadata.productName} from ${metadata.fromLocationName} to ${metadata.toLocationName} has been approved`,
          // link: `/dashboard/inventory/product/${transfer.productVariantId}`,
          link: `/dashboard/inventory/transfers/${id}`,
        },
      });

      return updatedTransfer;
    });

    return NextResponse.json({
      success: true,
      message: "Transfer approved and inventory updated",
    });
  } catch (error) {
    console.error("Error approving transfer:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to approve transfer",
      },
      { status: 500 }
    );
  }
}
