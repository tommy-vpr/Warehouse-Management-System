"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart,
  Package,
  AlertTriangle,
  Calendar,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface ReorderRequest {
  id: string;
  productVariantId: string;
  productName: string;
  sku: string;
  volume?: string;
  strength?: string;
  currentStock: number;
  reorderPoint: number;
  suggestedQuantity: number;
  supplier?: string;
  notes: string;
  createdAt: string;
  requestedBy: string;
  hasBeenOrdered: boolean;
}

export default function ReorderReviewPage(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [showProcessed, setShowProcessed] = useState(false);

  const router = useRouter();

  const { data: reorders, isLoading } = useQuery<ReorderRequest[]>({
    queryKey: ["reorder-requests"],
    queryFn: async () => {
      const res = await fetch("/api/purchasing/reorders");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  // Group by supplier
  const groupedBySupplier = reorders?.reduce((acc, item) => {
    const supplier = item.supplier || "Unknown Supplier";
    if (!acc[supplier]) acc[supplier] = [];
    acc[supplier].push(item);
    return acc;
  }, {} as Record<string, ReorderRequest[]>);

  console.log(reorders);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600 dark:text-gray-400">
            Loading reorder list...
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Reorder Requests</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Review and convert to purchase orders
            </p>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{reorders?.length || 0}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Pending Requests
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">
                {Object.keys(groupedBySupplier || {}).length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Suppliers
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Grouped by Supplier */}
        {Object.entries(groupedBySupplier || {}).map(([supplier, items]) => (
          <Card key={supplier} className="mb-4">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>{supplier}</CardTitle>
                <Button
                  size="sm"
                  onClick={() => {
                    const itemIds = items
                      .map((i) => i.productVariantId)
                      .join(",");
                    router.push(
                      `/dashboard/purchasing/orders/create?supplier=${encodeURIComponent(
                        supplier
                      )}&items=${itemIds}`
                    );
                  }}
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Create PO ({items.length} items)
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b">
                    <tr className="text-left text-sm text-gray-600 dark:text-gray-400">
                      <th className="pb-2">Product</th>
                      <th className="pb-2">Current Stock</th>
                      <th className="pb-2">Reorder Point</th>
                      <th className="pb-2">Suggested Qty</th>
                      <th className="pb-2">Requested</th>
                      <th className="pb-2">By</th>
                      <th className="pb-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b">
                        <td className="py-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {item.productName}
                              </span>
                              {item.hasBeenOrdered && (
                                <Badge variant="secondary" className="text-xs">
                                  Ordered
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">
                              SKU: {item.sku}
                              {item.volume && ` • ${item.volume}`}
                              {item.strength && ` • ${item.strength}`}
                            </div>
                          </div>
                        </td>
                        <td className="py-3">
                          {/* <Badge variant={"outline"}>{item.currentStock}</Badge> */}
                          {item.currentStock}
                        </td>
                        <td className="py-3">{item.reorderPoint || "N/A"}</td>
                        <td className="py-3 font-semibold">
                          {item.suggestedQuantity}
                        </td>
                        <td className="py-3">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 text-sm text-gray-600 dark:text-gray-400">
                          {item.requestedBy}
                        </td>
                        <td className="py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              router.push(
                                `/dashboard/purchasing/orders/create?supplier=${encodeURIComponent(
                                  supplier
                                )}&items=${item.productVariantId}`
                              );
                            }}
                            disabled={item.hasBeenOrdered}
                          >
                            <ShoppingCart className="w-4 h-4 mr-2" />
                            {item.hasBeenOrdered ? "Ordered" : "Create PO"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))}

        {(!reorders || reorders.length === 0) && (
          <Card>
            <CardContent className="p-12 text-center">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Pending Reorders</h3>
              <p className="text-gray-600 dark:text-gray-400">
                All reorder requests have been processed
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
