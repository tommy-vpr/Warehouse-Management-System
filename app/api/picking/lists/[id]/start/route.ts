import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Update pick list status and start time
    const pickList = await prisma.pickList.update({
      where: { id },
      data: {
        status: "IN_PROGRESS",
        startTime: new Date(),
        assignedTo: session.user.id,
      },
      include: {
        items: {
          include: {
            order: { select: { orderNumber: true } },
            productVariant: { select: { sku: true, name: true } },
            location: { select: { name: true } },
          },
        },
      },
    });

    // Log the start event
    await prisma.pickEvent.create({
      data: {
        pickListId: id,
        eventType: "PICK_STARTED",
        userId: session.user.id,
        notes: `Pick list started by ${session.user.name}`,
      },
    });

    return NextResponse.json({
      success: true,
      pickList: {
        id: pickList.id,
        batchNumber: pickList.batchNumber,
        status: pickList.status,
        startTime: pickList.startTime,
        totalItems: pickList.totalItems,
      },
    });
  } catch (error) {
    console.error("Error starting pick list:", error);
    return NextResponse.json(
      { error: "Failed to start pick list" },
      { status: 500 }
    );
  }
}
