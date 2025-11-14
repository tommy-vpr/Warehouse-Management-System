// app/api/inventory-planner/purchase-orders/with-barcodes/route.ts
// Enhanced PO list that includes barcode status
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const API_URL = process.env.INVENTORY_PLANNER_API!;
const API_KEY = process.env.INVENTORY_PLANNER_KEY!;
const ACCOUNT_ID = process.env.INVENTORY_PLANNER_ACCOUNT!;

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "open";
    const limit = parseInt(searchParams.get("limit") || "20");
    const page = parseInt(searchParams.get("page") || "0");

    // Fetch POs from Inventory Planner
    const url = `${API_URL}/purchase-orders?status=${status}&limit=${limit}&page=${page}`;
    const response = await fetch(url, {
      headers: {
        Authorization: API_KEY,
        Account: ACCOUNT_ID,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const purchaseOrders = data["purchase-orders"] || [];

    // Get all PO IDs
    const poIds = purchaseOrders.map((po: any) => po.id);

    // Fetch barcode status for all POs in one query
    const barcodes = await prisma.pOBarcode.findMany({
      where: {
        poId: { in: poIds },
      },
      select: {
        poId: true,
        id: true,
        status: true,
      },
    });

    // Create a map for quick lookup
    const barcodeMap = new Map(
      barcodes.map((b) => [b.poId, { id: b.id, status: b.status }])
    );

    // Check for pending sessions
    const pendingSessions = await prisma.receivingSession.findMany({
      where: {
        poId: { in: poIds },
        status: "PENDING",
      },
      select: { poId: true },
    });

    const pendingPoIds = new Set(pendingSessions.map((s) => s.poId));

    // Transform and enhance POs
    const enhancedPOs = purchaseOrders.map((po: any) => {
      const barcode = barcodeMap.get(po.id);

      return {
        id: po.id,
        reference: po.reference,
        vendor_name:
          po.vendor_display_name ||
          po.warehouse_display_name ||
          "Unknown Vendor",
        status: po.status || "unknown",
        created_at: po.created_at || po.created_date,
        expected_date: po.expected_date,
        total_cost: po.total || 0,
        currency: po.currency || "USD",
        line_items: (po.items || []).map((item: any) => ({
          sku: (item.sku || "").trim(),
          quantity_ordered: item.replenishment || item.remaining || 0,
        })),
        hasPendingSession: pendingPoIds.has(po.id),
        // NEW: Barcode info
        barcodeId: barcode?.id || null,
        barcodeStatus: barcode?.status || null,
        hasBarcode: !!barcode,
      };
    });

    return NextResponse.json({
      success: true,
      purchaseOrders: enhancedPOs,
      meta: {
        total: data.meta?.total_results || enhancedPOs.length,
        page,
        limit,
      },
    });
  } catch (error: any) {
    console.error("[PO API] Error:", error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
