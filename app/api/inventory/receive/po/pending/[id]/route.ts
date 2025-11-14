// app/api/inventory/receive/po/pending/[id]/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const receivingSession = await prisma.receivingSession.findUnique({
      where: {
        id,
      },
      include: {
        lineItems: {
          orderBy: {
            sku: "asc",
          },
        },
        countedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!receivingSession) {
      return NextResponse.json(
        { error: "Receiving session not found" },
        { status: 404 }
      );
    }

    // Check if user has permission to view
    const canView =
      session.user.role === "ADMIN" ||
      session.user.role === "MANAGER" ||
      receivingSession.countedBy === session.user.id;

    if (!canView) {
      return NextResponse.json(
        { error: "Forbidden - Insufficient permissions" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      session: receivingSession,
    });
  } catch (error: any) {
    console.error("❌ Failed to fetch receiving session:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
