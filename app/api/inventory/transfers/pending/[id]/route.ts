import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    console.log("🔍 Looking for transfer:", id);

    // First, let's see if the transfer exists at all
    const anyTransfer = await prisma.inventoryTransaction.findUnique({
      where: { id },
    });

    console.log("📦 Found transfer:", anyTransfer);

    // Now try with the referenceType filter
    const transfer = await prisma.inventoryTransaction.findFirst({
      where: {
        id,
        referenceType: "TRANSFER_PENDING",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        productVariant: {
          include: {
            product: true,
          },
        },
      },
    });

    console.log("✅ Transfer with PENDING filter:", transfer);

    if (!transfer) {
      console.log("❌ Transfer not found or not pending");
      return NextResponse.json(
        { error: "Transfer not found or not pending" },
        { status: 404 }
      );
    }

    // Check if user is the assigned confirmer
    const metadata = transfer.metadata as any;
    console.log("👤 Metadata:", metadata);
    console.log("👤 Session user ID:", session.user.id);
    console.log("👤 Confirmer ID:", metadata?.confirmerId);

    if (metadata?.confirmerId !== session.user.id) {
      return NextResponse.json(
        { error: "You are not authorized to confirm this transfer" },
        { status: 403 }
      );
    }

    return NextResponse.json(transfer);
  } catch (error) {
    console.error("Error fetching pending transfer:", error);
    return NextResponse.json(
      { error: "Failed to fetch transfer" },
      { status: 500 }
    );
  }
}
