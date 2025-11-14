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

    const transfer = await prisma.inventoryTransaction.findFirst({
      where: {
        id,
        transactionType: "TRANSFER",
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

    if (!transfer) {
      return NextResponse.json(
        { error: "Transfer not found" },
        { status: 404 }
      );
    }

    // Get confirmer name if available
    const metadata = transfer.metadata as any;
    if (metadata?.confirmerId) {
      const confirmer = await prisma.user.findUnique({
        where: { id: metadata.confirmerId },
        select: { name: true },
      });
      if (confirmer) {
        metadata.confirmerName = confirmer.name;
      }
    }

    return NextResponse.json({
      ...transfer,
      metadata,
    });
  } catch (error) {
    console.error("Error fetching transfer:", error);
    return NextResponse.json(
      { error: "Failed to fetch transfer" },
      { status: 500 }
    );
  }
}
