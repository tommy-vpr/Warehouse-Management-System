"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Download,
  Calendar,
  User,
  Package,
  DollarSign,
  FileText,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";

interface PODetails {
  poNumber: string;
  supplier: string;
  expectedDate?: string;
  status: string;
  totalCost: number;
  createdAt: string;
  createdBy: string;
  notes?: string;
  items: Array<{
    productVariantId: string;
    productName: string;
    sku: string;
    volume?: string;
    strength?: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
  }>;
}

export default function PurchaseOrderDetail(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const poNumber = params.id;
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  const {
    data: po,
    isLoading,
    isError,
  } = useQuery<PODetails>({
    queryKey: ["purchase-order", poNumber],
    queryFn: async () => {
      const res = await fetch(`/api/purchasing/orders/${poNumber}`);
      if (!res.ok) throw new Error("PO not found");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600 dark:text-gray-400">
            Loading purchase order...
          </p>
        </div>
      </div>
    );
  }

  if (isError || !po) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            Purchase order not found
          </p>
          <Button
            onClick={() => router.push("/dashboard/purchasing/orders")}
            className="mt-4"
          >
            Back to Orders
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Button
              variant="ghost"
              onClick={() => router.push("/dashboard/purchasing/orders")}
              className="mr-4"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Purchase Order</h1>
              <p className="text-gray-600 dark:text-emerald-400">
                PO Number: <span className="font-mono">{po.poNumber}</span>
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              disabled={downloadingPDF}
              onClick={async () => {
                try {
                  setDownloadingPDF(true);
                  const response = await fetch(
                    `/api/purchasing/orders/${params.id}/download`
                  );
                  if (response.ok) {
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${po.poNumber}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                  } else {
                    alert("Failed to download PDF");
                  }
                } catch (error) {
                  console.error("Failed to download PDF:", error);
                  alert("Error downloading PDF");
                } finally {
                  setDownloadingPDF(false);
                }
              }}
            >
              {downloadingPDF ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </>
              )}
            </Button>
            <Badge
              variant="secondary"
              className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
            >
              {po.status || "DRAFT"}
            </Badge>
          </div>
        </div>

        {/* PO Summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Order Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-1">
                  <Package className="w-4 h-4 mr-2" />
                  Supplier
                </div>
                <div className="font-semibold">{po.supplier}</div>
              </div>
              <div>
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-1">
                  <Calendar className="w-4 h-4 mr-2" />
                  Expected Delivery
                </div>
                <div className="font-semibold">
                  {po.expectedDate
                    ? new Date(po.expectedDate).toLocaleDateString()
                    : "Not set"}
                </div>
              </div>
              <div>
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-1">
                  <User className="w-4 h-4 mr-2" />
                  Created By
                </div>
                <div className="font-semibold">{po.createdBy}</div>
              </div>
              <div>
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-1">
                  <DollarSign className="w-4 h-4 mr-2" />
                  Total Cost
                </div>
                <div className="font-semibold text-xl">
                  ${po.totalCost.toFixed(2)}
                </div>
              </div>
            </div>

            {po.notes && (
              <div className="mt-6 p-4 bg-gray-50 dark:bg-zinc-900 rounded-lg">
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-2">
                  <FileText className="w-4 h-4 mr-2" />
                  Notes
                </div>
                <p className="text-sm">{po.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader>
            <CardTitle>Line Items ({po.items.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr className="text-left text-sm text-gray-600 dark:text-gray-400">
                    <th className="pb-3">Product</th>
                    <th className="pb-3">SKU</th>
                    <th className="pb-3 text-right">Quantity</th>
                    <th className="pb-3 text-right">Unit Cost</th>
                    <th className="pb-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {po.items.map((item, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-4">
                        <div>
                          <div className="font-medium">{item.productName}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-300">
                            {item.volume && `${item.volume} • `}
                            {item.strength}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 text-sm">{item.sku}</td>
                      <td className="py-4 text-right font-medium">
                        {item.quantity}
                      </td>
                      <td className="py-4 text-right">
                        ${item.unitCost.toFixed(2)}
                      </td>
                      <td className="py-4 text-right font-semibold">
                        ${item.totalCost.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2">
                  <tr>
                    <td colSpan={4} className="py-4 text-right font-semibold">
                      Total:
                    </td>
                    <td className="py-4 text-right text-xl font-bold">
                      ${po.totalCost.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
