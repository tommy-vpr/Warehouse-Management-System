// app/api/inventory/cycle-counts/campaigns/[id]/export/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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

    // Get campaign with all tasks
    const campaign = await prisma.cycleCountCampaign.findUnique({
      where: { id },
      include: {
        tasks: {
          include: {
            location: true,
            productVariant: {
              include: {
                product: true,
              },
            },
            assignedUser: {
              select: {
                name: true,
              },
            },
          },
          orderBy: { taskNumber: "asc" },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Generate CSV content
    const csvHeaders = [
      "Task Number",
      "Location",
      "Zone",
      "Product Name",
      "SKU",
      "System Quantity",
      "Counted Quantity",
      "Variance",
      "Variance %",
      "Status",
      "Assigned To",
      "Completed At",
      "Notes",
    ];

    const csvRows = campaign.tasks.map((task) => [
      task.taskNumber,
      task.location.name,
      task.location.zone || "",
      task.productVariant?.product.name || "Location Count",
      task.productVariant?.sku || "",
      task.systemQuantity,
      task.countedQuantity || "",
      task.variance || "",
      task.variancePercentage ? `${task.variancePercentage.toFixed(2)}%` : "",
      task.status,
      task.assignedUser?.name || "",
      task.completedAt ? new Date(task.completedAt).toLocaleString() : "",
      task.notes || "",
    ]);

    // Create CSV content
    const csvContent = [
      csvHeaders.join(","),
      ...csvRows.map((row) =>
        row
          .map((cell) =>
            typeof cell === "string" && cell.includes(",")
              ? `"${cell.replace(/"/g, '""')}"`
              : cell
          )
          .join(",")
      ),
    ].join("\n");

    // Return CSV as downloadable file
    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="campaign-${campaign.name.replace(
          /[^a-zA-Z0-9]/g,
          "-"
        )}-export.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting campaign:", error);
    return NextResponse.json(
      { error: "Failed to export campaign" },
      { status: 500 }
    );
  }
}
