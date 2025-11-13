// app/api/returns/[rmaNumber]/receive/route.ts
// API route to receive a returned package

import { NextRequest, NextResponse } from "next/server";
import { returnService } from "@/lib/services/returnServices";
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

    const body = await request.json();
    const { trackingNumber } = body;

    const result = await returnService.receiveReturn(
      rmaNumber,
      session.user.id,
      trackingNumber
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error receiving return:", error);
    return NextResponse.json(
      { error: error.message || "Failed to receive return" },
      { status: 500 }
    );
  }
}
