// app/api/inventory/receive/session/[poId]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await prisma.receivingSession.findFirst({
    where: {
      poId: id,
      status: "PENDING",
    },
    include: {
      lineItems: true,
    },
  });

  return NextResponse.json({ session });
}
