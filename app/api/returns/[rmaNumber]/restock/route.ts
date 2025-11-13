// app/api/returns/[rmaNumber]/restock/route.ts
// API route to restock inspected items

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
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { rmaNumber } = await params;

    // Get return order ID from RMA number
    const returnOrder = await prisma.returnOrder.findUnique({
      where: { rmaNumber },
      select: { id: true },
    });

    if (!returnOrder) {
      return NextResponse.json({ error: "Return not found" }, { status: 404 });
    }

    const result = await returnService.restockReturnedItems(
      returnOrder.id,
      session.user.id
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error restocking items:", error);
    return NextResponse.json(
      { error: error.message || "Failed to restock items" },
      { status: 500 }
    );
  }
}
