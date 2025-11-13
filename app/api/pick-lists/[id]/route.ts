// app/api/pick-lists/[id]/route.ts
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pickList = await prisma.pickList.findUnique({
    where: { id },
    include: {
      assignedUser: {
        select: { id: true, name: true, email: true },
      },
      items: {
        include: {
          productVariant: {
            include: { product: true },
          },
          location: true,
          order: {
            select: { orderNumber: true, customerName: true },
          },
        },
        orderBy: { pickSequence: "asc" },
      },
      parentPickList: true,
      continuations: true,
    },
  });

  if (!pickList) {
    return NextResponse.json({ error: "Pick list not found" }, { status: 404 });
  }

  return NextResponse.json(pickList);
}

// PATCH /api/pick-lists/[id] - Update pick list
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { status, assignedTo, notes } = body;

  const pickList = await prisma.pickList.update({
    where: { id: params.id },
    data: {
      ...(status && { status }),
      ...(assignedTo && { assignedTo }),
      ...(notes && { notes }),
    },
  });

  return NextResponse.json(pickList);
}
