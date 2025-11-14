// app/dashboard/inventory/receive/label/[id]/page.tsx
// Mobile Responsive Version
"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import POBarcodeLabel from "@/components/inventory/POBarcodeLabel";

export default function POBarcodeLabelPage(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = useParams();
  const router = useRouter();
  const barcodeId = params.id as string;

  const { data, isLoading, error } = useQuery({
    queryKey: ["po-barcode", barcodeId],
    queryFn: async () => {
      const res = await fetch(`/api/inventory/po-barcode/${barcodeId}`);
      if (!res.ok) throw new Error("Failed to fetch barcode");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Loading barcode label...
          </p>
        </div>
      </div>
    );
  }

  if (error || !data?.barcode) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-600 mb-4 text-sm sm:text-base">
            Failed to load barcode label
          </p>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-4">
            {error instanceof Error ? error.message : "An error occurred"}
          </p>
          <Button onClick={() => router.back()} size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const { barcode } = data;
  const totalItems = barcode.expectedItems?.length || 0;
  const totalUnits = barcode.totalExpectedQty || 0;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-background p-3 sm:p-6">
      {/* Navigation - hidden when printing */}
      <div className="print:hidden mb-4 sm:mb-6 max-w-4xl mx-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard/inventory/receive/po")}
          className="cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          <span className="text-sm sm:text-base">Back to PO List</span>
        </Button>
      </div>

      <POBarcodeLabel
        barcodeValue={barcode.barcodeValue}
        poReference={barcode.poReference}
        vendorName={barcode.vendorName}
        totalItems={totalItems}
        totalUnits={totalUnits}
        generatedBy={
          barcode.lastPrintedByUser?.name ||
          barcode.lastPrintedByUser?.email ||
          undefined
        }
      />
    </div>
  );
}
