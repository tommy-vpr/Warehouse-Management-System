import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { calculateCampaignAnalytics } from "@/utils/cycle-count-analytics";
import { generateCycleCountReportHTML } from "@/utils/cycle-count-report-template";
import { generatePDF } from "@/utils/pdf-generator";

interface Params {
  id: string;
}

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

    const campaign = await prisma.cycleCountCampaign.findUnique({
      where: { id },
      include: {
        tasks: {
          include: {
            location: true,
            productVariant: { include: { product: true } },
            assignedUser: { select: { name: true } },
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

    // Build analytics + HTML
    const analytics = calculateCampaignAnalytics(campaign);
    const htmlContent = generateCycleCountReportHTML(campaign, analytics);

    // Generate PDF as Buffer
    const pdfBuffer = await generatePDF(htmlContent);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="cycle-count-report-${campaign.name.replace(
          /[^a-zA-Z0-9]/g,
          "-"
        )}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}
