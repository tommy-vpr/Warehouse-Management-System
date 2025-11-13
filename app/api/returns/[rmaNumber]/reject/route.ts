// app/api/returns/[rmaNumber]/reject/route.ts
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
    const body = await request.json();
    const { reason } = body;

    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { error: "Rejection reason is required" },
        { status: 400 }
      );
    }

    console.log("❌ Rejecting return:", rmaNumber);

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

    // Update return to rejected
    const updatedReturn = await prisma.returnOrder.update({
      where: { rmaNumber },
      data: {
        status: "REJECTED",
        rejectionReason: reason,
        approvedBy: userId, // Track who made the decision
        approvedAt: new Date(),
      },
    });

    // Create event
    await prisma.returnEvent.create({
      data: {
        returnOrderId: updatedReturn.id,
        eventType: "RMA_REJECTED",
        userId,
        notes: reason,
      },
    });

    console.log("❌ Return rejected:", rmaNumber);

    // TODO: Send rejection email to customer
    // await sendReturnRejectionEmail(returnOrder.customerEmail, rmaNumber, reason);

    return NextResponse.json(updatedReturn);
  } catch (error) {
    console.error("❌ Error rejecting return:", error);
    return NextResponse.json(
      { error: "Failed to reject return" },
      { status: 500 }
    );
  }
}
