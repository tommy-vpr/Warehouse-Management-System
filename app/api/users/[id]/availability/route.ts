// app/api/users/[id]/availability/route.ts
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/users/[id]/availability
 * Mark user as unavailable and handle their work
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const body = await req.json();
  const {
    unavailableUntil, // Date when they'll be back
    reason, // 'sick', 'vacation', 'shift_end', etc.
    replacementUserId, // Optional immediate replacement
    autoReassign = false,
  } = body;

  try {
    const { id } = await params;
    // Check if user has active work
    const incompleteLists = await prisma.pickList.findMany({
      where: {
        assignedTo: id,
        status: {
          in: ["ASSIGNED", "IN_PROGRESS", "PAUSED"],
        },
      },
    });

    if (incompleteLists.length === 0) {
      return NextResponse.json({
        success: true,
        message: "User has no active work",
        incompleteLists: [],
      });
    }

    // Handle work reassignment
    if (replacementUserId) {
      // Reassign to specific replacement
      for (const list of incompleteLists) {
        await fetch(`/api/pick-lists/${list.id}/reassign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            newStaffId: replacementUserId,
            strategy: "split",
          }),
        });
      }
    } else if (autoReassign) {
      // Auto-assign to available staff
      const availableStaff = await prisma.user.findMany({
        where: {
          role: "STAFF",
          id: { not: id },
        },
        include: {
          assignedPickLists: {
            where: {
              status: {
                in: ["ASSIGNED", "IN_PROGRESS"],
              },
            },
          },
        },
      });

      // Sort by current workload
      availableStaff.sort((a, b) => {
        const aWorkload = a.assignedPickLists.length;
        const bWorkload = b.assignedPickLists.length;
        return aWorkload - bWorkload;
      });

      if (availableStaff.length > 0) {
        const lightestStaff = availableStaff[0];

        for (const list of incompleteLists) {
          await fetch(`/api/pick-lists/${list.id}/reassign`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              newStaffId: lightestStaff.id,
              strategy: "split",
            }),
          });
        }
      }
    } else {
      // Just pause the work
      await prisma.pickList.updateMany({
        where: {
          id: { in: incompleteLists.map((pl) => pl.id) },
        },
        data: {
          status: "PAUSED",
          notes: `Paused - ${reason} - user unavailable until ${unavailableUntil}`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "User availability updated",
      incompleteLists: incompleteLists.length,
      action: replacementUserId
        ? "REASSIGNED"
        : autoReassign
        ? "AUTO_REASSIGNED"
        : "PAUSED",
    });
  } catch (error) {
    console.error("Error updating availability:", error);
    return NextResponse.json(
      { error: "Failed to update availability" },
      { status: 500 }
    );
  }
}
