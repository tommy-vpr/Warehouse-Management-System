// app/api/inventory/receive/session/[poId]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ poId: string }> } // ← Changed to poId
) {
  const { poId } = await params; // ← Changed to poId

  const session = await prisma.receivingSession.findFirst({
    where: {
      poId: poId, // ← Using poId
      status: "PENDING",
    },
    include: {
      lineItems: true,
    },
  });

  return NextResponse.json({ session });
}
