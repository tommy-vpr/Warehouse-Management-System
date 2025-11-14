import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        assignedPickLists: {
          where: {
            status: {
              in: ["ASSIGNED", "IN_PROGRESS", "PAUSED"],
            },
          },
          include: {
            items: true,
          },
        },
        pickingOrders: {
          where: {
            status: {
              in: ["PICKING", "ALLOCATED"],
            },
          },
        },
        packingOrders: {
          where: {
            status: "PICKED",
          },
        },
        shippingOrders: {
          where: {
            status: "PACKED",
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Calculate stats
    const stats = {
      activePickLists: user.assignedPickLists.length,
      pickingOrders: user.pickingOrders.length,
      packingOrders: user.packingOrders.length,
      shippingOrders: user.shippingOrders.length,
      totalRemainingItems: user.assignedPickLists.reduce(
        (sum, pl) => sum + (pl.totalItems - pl.pickedItems),
        0
      ),
    };

    return NextResponse.json({
      ...user,
      stats,
      // Remove password from response
      password: undefined,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/users/[id]
 * Update a user
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const body = await req.json();
  const { name, email, role, image } = body;
  const { id } = await params;

  try {
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(role && { role }),
        ...(image && { image }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/users/[id]
 * Delete a user
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Check if user has active work
    const user = await prisma.user.findUnique({
      where: { id },
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

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.assignedPickLists.length > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete user with active pick lists",
          activePickLists: user.assignedPickLists.length,
        },
        { status: 400 }
      );
    }

    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
