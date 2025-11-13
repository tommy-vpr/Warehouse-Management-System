// app/api/returns/[rmaNumber]/process-refund/route.ts
// API route to process refund

import { NextRequest, NextResponse } from "next/server";
import { returnService } from "@/lib/services/returnServices";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ rmaNumber: string }> }
) {
  try {
    const { rmaNumber } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check user has permission (admin/manager only)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!["ADMIN", "MANAGER"].includes(user?.role || "")) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Get return order ID from RMA number
    const returnOrder = await prisma.returnOrder.findUnique({
      where: { rmaNumber },
      select: { id: true },
    });

    if (!returnOrder) {
      return NextResponse.json({ error: "Return not found" }, { status: 404 });
    }

    const result = await returnService.processRefund(
      returnOrder.id,
      session.user.id
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error processing refund:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process refund" },
      { status: 500 }
    );
  }
}
