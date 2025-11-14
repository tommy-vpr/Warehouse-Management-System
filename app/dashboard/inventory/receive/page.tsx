// app/dashboard/inventory/receive/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  FileText,
  TrendingUp,
  History,
  ArrowLeft,
  Clock,
} from "lucide-react";

export default function ReceivingPage(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const router = useRouter();

  // Get pending approvals count
  const { data: pendingData } = useQuery({
    queryKey: ["pending-receiving"],
    queryFn: async () => {
      const res = await fetch(`/api/inventory/receive/po/pending`);
      if (!res.ok) return { sessions: [] };
      const json = await res.json();
      return json;
    },
  });

  // Get open POs count
  const { data: posData } = useQuery({
    queryKey: ["purchase-orders-count"],
    queryFn: async () => {
      const res = await fetch(
        `/api/inventory-planner/purchase-orders?status=open&limit=1000`
      );
      if (!res.ok) return { purchaseOrders: [] };
      const json = await res.json();
      return json;
    },
  });

  const pendingCount = pendingData?.sessions?.length || 0;
  const openPOsCount = posData?.purchaseOrders?.length || 0;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push("/dashboard/inventory")}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Inventory
          </button>

          <h1 className="text-3xl font-bold text-foreground mb-2">
            Receiving Center
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Receive purchase orders and manage inbound inventory
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Open POs
                  </p>
                  <p className="text-3xl font-bold">{openPOsCount}</p>
                </div>
                <FileText className="w-12 h-12 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Pending Approval
                  </p>
                  <p className="text-3xl font-bold">{pendingCount}</p>
                </div>
                <Clock className="w-12 h-12 text-gray-200 dark:tetx-gray-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Cards */}
        <div className="space-y-4">
          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => router.push("/dashboard/inventory/receive/po")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Package className="w-6 h-6 text-blue-600" />
                Receive Purchase Order
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
                Browse open purchase orders from Inventory Planner and start
                blind count receiving process.
              </p>
              <Button className="w-full">
                Browse Purchase Orders ({openPOsCount} open)
              </Button>
            </CardContent>
          </Card>

          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => router.push("/dashboard/inventory/receive/pending")}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <TrendingUp className="w-6 h-6 text-yellow-500" />
                Pending Approvals
                {pendingCount > 0 && (
                  //   <Badge className="bg-red-500 rounded-full">
                  //     {pendingCount}
                  //   </Badge>
                  <span className="h-5 w-5 bg-amber-400 text-black rounded-full text-xs flex justify-center items-center">
                    {pendingCount}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
                Review and approve receiving sessions submitted by warehouse
                staff. (Admin/Manager only)
              </p>
              <Button
                className="w-full"
                variant={pendingCount > 0 ? "default" : "outline"}
              >
                {pendingCount > 0
                  ? `Review ${pendingCount} Pending Approval${
                      pendingCount > 1 ? "s" : ""
                    }`
                  : "No Pending Approvals"}
              </Button>
            </CardContent>
          </Card>

          <Card
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() =>
              router.push("/dashboard/inventory/transactions?type=PO_RECEIVING")
            }
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <History className="w-6 h-6 text-purple-600" />
                Receiving History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
                View past receiving transactions and audit trail.
              </p>
              <Button variant="outline" className="w-full">
                <History className="w-4 h-4 mr-2" />
                View History
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
