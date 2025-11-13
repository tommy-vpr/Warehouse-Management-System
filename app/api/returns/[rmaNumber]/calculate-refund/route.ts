// app/api/returns/[rmaNumber]/calculate-refund/route.ts
// API route to calculate refund amount (preview)

import { NextRequest, NextResponse } from "next/server";
import { returnService } from "@/lib/services/returnServices";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ rmaNumber: string }> }
) {
  try {
    const { rmaNumber } = await params;
    // Get return order ID from RMA number
    const returnOrder = await prisma.returnOrder.findUnique({
      where: { rmaNumber },
      select: { id: true },
    });

    if (!returnOrder) {
      return NextResponse.json({ error: "Return not found" }, { status: 404 });
    }

    const calculation = await returnService.calculateRefund(returnOrder.id);

    return NextResponse.json(calculation);
  } catch (error: any) {
    console.error("Error calculating refund:", error);
    return NextResponse.json(
      { error: error.message || "Failed to calculate refund" },
      { status: 500 }
    );
  }
}
