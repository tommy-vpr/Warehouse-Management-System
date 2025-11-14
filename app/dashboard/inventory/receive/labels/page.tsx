// app/dashboard/inventory/receive/labels/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Loader2,
  Search,
  Printer,
  Calendar,
  Package,
  Scan,
  FileText,
  RefreshCw,
  AlertCircle,
  Eye,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface POBarcode {
  id: string;
  poId: string;
  poReference: string;
  vendorName: string;
  barcodeValue: string;
  barcodeType: string;
  printedCount: number;
  lastPrintedAt: string | null;
  scannedCount: number;
  lastScannedAt: string | null;
  totalExpectedQty: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface BarcodesResponse {
  success: boolean;
  barcodes: POBarcode[];
  total: number;
}

export default function BarcodeLabelsListPage(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading, error, refetch } = useQuery<BarcodesResponse>({
    queryKey: ["po-barcodes", statusFilter],
    queryFn: async () => {
      const res = await fetch(
        `/api/inventory/po-barcode/list?status=${statusFilter}`
      );
      if (!res.ok) throw new Error("Failed to fetch barcodes");
      return res.json();
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Filter by search term
  const filteredBarcodes = data?.barcodes?.filter((barcode) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      barcode.poReference.toLowerCase().includes(searchLower) ||
      barcode.vendorName.toLowerCase().includes(searchLower) ||
      barcode.barcodeValue.toLowerCase().includes(searchLower)
    );
  });

  const handleViewLabel = (barcodeId: string) => {
    router.push(`/dashboard/inventory/receive/label/${barcodeId}`);
  };

  const handleReprint = (barcodeId: string) => {
    // Navigate to label page (which has print button)
    router.push(`/dashboard/inventory/receive/label/${barcodeId}`);
    toast({
      title: "Opening label",
      description: "Click the print button to reprint",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            Loading barcode labels...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-600 mb-2">Failed to load barcode labels</p>
          <Button onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const totalLabels = data?.total || 0;
  const activeLabels =
    data?.barcodes?.filter((b) => b.status === "ACTIVE").length || 0;
  const usedLabels =
    data?.barcodes?.filter((b) => b.status === "USED").length || 0;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push("/dashboard/inventory/receive")}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Receiving
          </button>

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Purchase Order Labels
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                View and reprint generated receiving labels
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                <RefreshCw
                  className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
              {/* <Button
                onClick={() => router.push("/dashboard/inventory/receive/po")}
              >
                <Package className="w-4 h-4 mr-2" />
                Generate New Label
              </Button> */}
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <Scan className="w-8 h-8 text-blue-500" />
                  <div className="ml-3">
                    <p className="text-2xl font-bold">{totalLabels}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Total Labels
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <FileText className="w-8 h-8 text-green-600" />
                  <div className="ml-3">
                    <p className="text-2xl font-bold">{activeLabels}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Active
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <Package className="w-8 h-8 text-gray-600" />
                  <div className="ml-3">
                    <p className="text-2xl font-bold">{usedLabels}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Used
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by PO#, vendor, or barcode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="USED">Used</option>
            </select>
          </div>
        </div>

        {/* Labels List */}
        <div className="space-y-4">
          {filteredBarcodes && filteredBarcodes.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <Scan className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No barcode labels found
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {searchTerm
                    ? "No labels match your search"
                    : "Generate labels from the Purchase Orders page"}
                </p>
                <Button
                  onClick={() => router.push("/dashboard/inventory/receive/po")}
                >
                  <Package className="w-4 h-4 mr-2" />
                  Go to Purchase Orders
                </Button>
              </CardContent>
            </Card>
          )}

          {filteredBarcodes?.map((barcode) => (
            <Card
              key={barcode.id}
              className="hover:shadow-lg transition-shadow"
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center flex-wrap gap-x-6 gap-y-3">
                      {/* PO Number */}
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          PO #{barcode.poReference}
                        </h3>
                      </div>

                      {/* Status */}
                      <Badge
                        className={
                          barcode.status === "ACTIVE"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200"
                        }
                      >
                        {barcode.status}
                      </Badge>

                      {/* Vendor */}
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {barcode.vendorName}
                      </div>

                      {/* Created Date */}
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Calendar className="w-4 h-4" />
                        {new Date(barcode.createdAt).toLocaleDateString()}
                      </div>

                      {/* Expected Qty */}
                      {barcode.totalExpectedQty && (
                        <Badge variant="outline" className="text-xs">
                          <Package className="w-3 h-3 mr-1" />
                          {barcode.totalExpectedQty} units
                        </Badge>
                      )}

                      {/* Print Count */}
                      {barcode.printedCount > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <Printer className="w-3 h-3 mr-1" />
                          Printed {barcode.printedCount}x
                        </Badge>
                      )}

                      {/* Scan Count */}
                      {barcode.scannedCount > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <Scan className="w-3 h-3 mr-1" />
                          Scanned {barcode.scannedCount}x
                        </Badge>
                      )}
                    </div>

                    {/* Barcode Value */}
                    <div className="mt-2 font-mono text-xs text-gray-500">
                      {barcode.barcodeValue}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewLabel(barcode.id)}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleReprint(barcode.id)}
                      disabled={barcode.status === "USED"}
                      className="bg-blue-600 hover:blue-500 transition"
                    >
                      <Printer className="w-4 h-4 mr-2" />
                      Reprint
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
