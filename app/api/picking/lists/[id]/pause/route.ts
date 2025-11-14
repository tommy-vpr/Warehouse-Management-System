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
    const { reason } = await request.json();

    const pickList = await prisma.pickList.update({
      where: { id },
      data: { status: "PAUSED" },
    });

    // Log the pause event
    await prisma.pickEvent.create({
      data: {
        pickListId: id,
        eventType: "PICK_PAUSED",
        userId: session.user.id,
        notes: reason || "Pick list paused",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error pausing pick list:", error);
    return NextResponse.json(
      { error: "Failed to pause pick list" },
      { status: 500 }
    );
  }
}
