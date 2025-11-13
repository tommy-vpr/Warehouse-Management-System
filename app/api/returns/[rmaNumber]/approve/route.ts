// app/api/returns/[rmaNumber]/approve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ rmaNumber: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { rmaNumber } = await params;
    const userId = session.user.id;

    console.log("✅ Approving return:", rmaNumber);

    // Check if return exists and is pending
    const returnOrder = await prisma.returnOrder.findUnique({
      where: { rmaNumber },
    });

    if (!returnOrder) {
      return NextResponse.json({ error: "Return not found" }, { status: 404 });
    }

    if (returnOrder.status !== "PENDING") {
      return NextResponse.json(
        { error: "Return is not in pending status" },
        { status: 400 }
      );
    }

    // Update return to approved
    const updatedReturn = await prisma.returnOrder.update({
      where: { rmaNumber },
      data: {
        status: "APPROVED",
        approvedBy: userId,
        approvedAt: new Date(),
      },
    });

    // Create event
    await prisma.returnEvent.create({
      data: {
        returnOrderId: updatedReturn.id,
        eventType: "RMA_APPROVED",
        userId,
        notes: "Return approved by manager",
      },
    });

    console.log("✅ Return approved:", rmaNumber);

    return NextResponse.json(updatedReturn);
  } catch (error) {
    console.error("❌ Error approving return:", error);
    return NextResponse.json(
      { error: "Failed to approve return" },
      { status: 500 }
    );
  }
}
