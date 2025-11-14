// app/api/inventory/cycle-counts/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// app/api/inventory/cycle-counts/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Mock cycle count detail data
    const cycleCountDetail = {
      id,
      batchNumber: "CC-2025-001",
      status: "IN_PROGRESS",
      countType: "ABC_ANALYSIS",
      totalItems: 45,
      countedItems: 12,
      varianceItems: 2,
      assignedTo: session.user.id,
      startedAt: new Date().toISOString(),
      instructions:
        "Count all A-class items in Zone A. Pay special attention to high-value products.",
      tolerancePercentage: 5.0,
      items: [
        {
          id: "cci1",
          productVariantId: "pv1",
          productName: "Wireless Headphones",
          sku: "WH-001",
          upc: "123456789012",
          locationId: "loc1",
          locationName: "A-01-01",
          systemQuantity: 25,
          countedQuantity: 23,
          variance: -2,
          status: "VARIANCE",
          notes: "Two units found damaged",
          countedAt: new Date().toISOString(),
          countedBy: session.user.id,
        },
        {
          id: "cci2",
          productVariantId: "pv2",
          productName: "Bluetooth Speaker",
          sku: "BS-002",
          locationId: "loc2",
          locationName: "A-01-02",
          systemQuantity: 15,
          status: "PENDING",
        },
        // Add more mock items...
      ],
    };

    return NextResponse.json(cycleCountDetail);
  } catch (error) {
    console.error("Error fetching cycle count details:", error);
    return NextResponse.json(
      { error: "Failed to fetch cycle count details" },
      { status: 500 }
    );
  }
}
