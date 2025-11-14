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
      const transfer = await tx.inventoryTransaction.findUnique({
        where: {
          id,
          referenceType: "TRANSFER_PENDING",
        },
      });

      if (!transfer) {
        throw new Error("Transfer not found");
      }

      const metadata = transfer.metadata as any;

      if (metadata.confirmerId !== session.user.id) {
        throw new Error("Not authorized to reject this transfer");
      }

      if (metadata.status !== "PENDING") {
        throw new Error("Transfer already processed");
      }

      // Update transfer status
      const updatedTransfer = await tx.inventoryTransaction.update({
        where: { id },
        data: {
          referenceType: "TRANSFER_REJECTED",
          notes: `REJECTED: ${notes || "Transfer rejected"}`,
          metadata: {
            ...metadata,
            status: "REJECTED",
            rejectedBy: session.user.id,
            rejectedAt: new Date().toISOString(),
            rejectionNotes: notes,
          },
        },
      });

      // Notify requester
      await notifyUser(metadata.requestedBy, {
        type: "TRANSFER_REJECTED",
        title: "Transfer Rejected",
        message: `Your transfer of ${metadata.quantity} ${metadata.productName} has been rejected`,
        // link: `/dashboard/inventory/product/${transfer.productVariantId}`,
        link: `/dashboard/inventory/transfers/${id}`,
        timestamp: new Date().toISOString(),
      });

      await tx.notification.create({
        data: {
          userId: metadata.requestedBy,
          type: "TRANSFER_REJECTED",
          title: "Transfer Rejected",
          message: `Your transfer of ${metadata.quantity} ${
            metadata.productName
          } from ${metadata.fromLocationName} to ${
            metadata.toLocationName
          } has been rejected${notes ? `: ${notes}` : ""}`,
          // link: `/dashboard/inventory/product/${transfer.productVariantId}`,
          link: `/dashboard/inventory/transfers/${id}`,
        },
      });

      return updatedTransfer;
    });

    return NextResponse.json({
      success: true,
      message: "Transfer rejected",
    });
  } catch (error) {
    console.error("Error rejecting transfer:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to reject transfer",
      },
      { status: 500 }
    );
  }
}
