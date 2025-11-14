// app/dashboard/inventory/receive/po/[id]/page.tsx
"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Package,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Plus,
  Minus,
  Send,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface POLineItem {
  id: string;
  sku: string;
  product_name: string;
  quantity_ordered: number;
  quantity_received?: number;
  unit_cost?: number;
}

interface PurchaseOrder {
  id: string;
  reference: string;
  vendor_name: string;
  status: string;
  created_at: string;
  expected_date?: string;
  line_items: POLineItem[];
}

interface TallyCount {
  [sku: string]: number;
}

export default function BlindCountReceivingPage(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const poId = params.id as string;

  const [tallyCounts, setTallyCounts] = useState<TallyCount>({});
  const [tallyMode, setTallyMode] = useState<1 | 5 | 10 | 20>(1);

  const [isUpdating, setIsUpdating] = useState(false);

  const [recentlyUpdated, setRecentlyUpdated] = useState<string | null>(null);

  // Fetch PO details
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["purchase-order", poId],
    queryFn: async () => {
      const res = await fetch(`/api/inventory-planner/purchase-orders/${poId}`);

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to fetch PO");
      }

      const json = await res.json();
      return json.purchaseOrder as PurchaseOrder;
    },
  });

  // Submit for approval mutation
  const submitMutation = useMutation({
    mutationFn: async (counts: TallyCount) => {
      const expectedQuantities: any = { metadata: {} };

      data?.line_items?.forEach((item) => {
        const trimmedSku = item.sku.trim(); // ← Add this
        expectedQuantities[trimmedSku] = item.quantity_ordered;
        expectedQuantities.metadata[trimmedSku] = {
          name: item.product_name,
        };
      });

      const res = await fetch(`/api/inventory/receive/po`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poId,
          poReference: data?.reference,
          vendor: data?.vendor_name,
          lineCounts: counts,
          expectedQuantities,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to submit receiving");
      }

      return res.json();
    },
    onSuccess: () => {
      toast({
        variant: "success",
        title: "✅ Submitted for Approval!",
        description: `Receiving session created. Awaiting manager/admin approval.`,
      });
      queryClient.invalidateQueries({ queryKey: ["pending-receiving"] });
      router.push("/dashboard/inventory/receive/pending");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "❌ Failed to Submit",
        description: error.message,
      });
    },
  });

  //   const handleTally = (sku: string, amount: number) => {
  //     if (isUpdating) return;

  //     setIsUpdating(true);
  //     setTallyCounts((prev) => ({
  //       ...prev,
  //       [sku]: Math.max(0, (prev[sku] || 0) + amount),
  //     }));

  //     setTimeout(() => setIsUpdating(false), 100);
  //   };
  const handleTally = (sku: string, amount: number) => {
    setTallyCounts((prev) => ({
      ...prev,
      [sku]: Math.max(0, (prev[sku] || 0) + amount),
    }));

    setRecentlyUpdated(sku);
    setTimeout(() => setRecentlyUpdated(null), 300);
  };

  const handleReset = (sku: string) => {
    setTallyCounts((prev) => {
      const newCounts = { ...prev };
      delete newCounts[sku];
      return newCounts;
    });
  };

  const handleResetAll = () => {
    setTallyCounts({});
    toast({
      title: "Counts Reset",
      description: "All counts have been cleared.",
    });
  };

  const handleSubmit = () => {
    if (Object.keys(tallyCounts).length === 0) {
      toast({
        variant: "destructive",
        title: "No Counts Entered",
        description: "Please count at least one item before submitting.",
      });
      return;
    }

    submitMutation.mutate(tallyCounts);
  };

  const totalCounted = Object.values(tallyCounts).reduce(
    (sum, count) => sum + count,
    0
  );
  const itemsCounted = Object.keys(tallyCounts).length;
  const totalItems = data?.line_items?.length || 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading purchase order...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-2">Failed to load purchase order</p>
          <p className="text-sm text-gray-600 mb-4">{error.message}</p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!data || !data.line_items || data.line_items.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">
            {!data
              ? "Purchase Order not found"
              : "No line items in this purchase order"}
          </p>
          <Button onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to PO List
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                PO Receiving
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                PO #{data.reference} • {data.vendor_name}
              </p>
            </div>
            {/* <Badge className="text-xs px-4 py-2">
              {data.status.toUpperCase()}
            </Badge> */}
            <span className="border border-green-200 dark:border-green-400 bg-green-200 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-3 py-1 rounded-4xl text-xs font-semibold">
              {data.status.toUpperCase()}
            </span>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Tally Mode</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              {[1, 5, 10, 20].map((mode) => (
                <Button
                  key={mode}
                  variant={tallyMode === mode ? "outline" : "secondary"}
                  onClick={() => setTallyMode(mode as 1 | 5 | 10 | 20)}
                  className="flex-1"
                >
                  Count by {mode}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Total Items
                </p>
                <p className="text-3xl font-bold">{totalItems}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Items Counted
                </p>
                <p className="text-3xl font-bold">{itemsCounted}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Total Counted
                </p>
                <p className="text-3xl font-bold text-green-600">
                  {totalCounted}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Progress
                </p>
                <p className="text-3xl font-bold">
                  {itemsCounted}/{totalItems}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  Items to Receive{" "}
                  <span className="ml-2 bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 dark:border dark:border-violet-300 text-sm px-3 py-1 rounded-4xl m-auto font-normal">
                    Blind Count
                  </span>
                </CardTitle>
              </div>
              {itemsCounted > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetAll}
                  className="text-red-600 hover:text-red-700"
                >
                  Reset All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.line_items.map((item, index) => {
                const counted = tallyCounts[item.sku] || 0;
                const isCounted = counted > 0;

                // ✅ Use a combination of id and sku for unique keys
                const uniqueKey = `${item.sku}-${index}`;

                return (
                  <Card
                    key={uniqueKey}
                    className={`p-4 transition-all ${
                      isCounted
                        ? "border-green-500 dark:border-green-600 bg-green-50 dark:bg-green-900/10"
                        : ""
                    } ${
                      recentlyUpdated === item.sku
                        ? "ring-2 ring-blue-500 scale-[1.01]"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          {isCounted && (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          )}
                          <div>
                            <p className="font-semibold text-lg">
                              {item.product_name}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-500">
                              SKU: {item.sku}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[100px]">
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Counted
                          </p>
                          <p className="text-3xl font-bold">{counted}</p>
                        </div>

                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleTally(item.sku, tallyMode)}
                              className="w-16"
                            >
                              <Plus className="w-4 h-4" />
                              {tallyMode}
                            </Button>
                            {counted > 0 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleTally(item.sku, -tallyMode)
                                }
                                disabled={counted < tallyMode}
                                className="w-16"
                              >
                                <Minus className="w-4 h-4" />
                                {tallyMode}
                              </Button>
                            )}
                          </div>
                          {counted > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleReset(item.sku)}
                              className="text-xs text-red-600 hover:text-red-700"
                            >
                              Reset
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={() => router.back()}
            disabled={submitMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitMutation.isPending || itemsCounted === 0}
            className="min-w-[200px] bg-blue-500"
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>Submit for Approval ({totalCounted} units)</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
