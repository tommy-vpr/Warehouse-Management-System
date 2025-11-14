"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart,
  Package,
  AlertTriangle,
  TrendingDown,
  DollarSign,
  Clock,
  FileText,
  Plus,
  ArrowRight,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface PurchasingStats {
  pendingReorders: number;
  criticalItems: number;
  lowStockItems: number;
  openPurchaseOrders: number;
  estimatedValue: number;
  suppliersNeeded: number;
}

interface RecentRequest {
  id: string;
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
  hasBeenOrdered: boolean; // Add this new field
}

interface QuickAction {
  title: string;
  description: string;
  icon: any;
  href: string;
  count?: number;
  variant?: "default" | "destructive" | "outline";
}

export default function PurchasingDashboard(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const router = useRouter();

  const { data: stats } = useQuery<PurchasingStats>({
    queryKey: ["purchasing-stats"],
    queryFn: async () => {
      const res = await fetch("/api/purchasing/stats");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: recentRequests } = useQuery<RecentRequest[]>({
    queryKey: ["recent-reorder-requests"],
    queryFn: async () => {
      const res = await fetch(
        "/api/purchasing/reorders?showProcessed=true&limit=5"
      );
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  console.log(recentRequests);

  const quickActions: QuickAction[] = [
    {
      title: "Reorder Requests",
      description: "Review pending reorder requests",
      icon: ShoppingCart,
      href: "/dashboard/purchasing/reorders",
      count: stats?.pendingReorders,
      variant: "default",
    },
    {
      title: "Critical Stock",
      description: "Items needing immediate attention",
      icon: AlertTriangle,
      href: "/dashboard/purchasing/inventory?status=CRITICAL",
      count: stats?.criticalItems,
      variant: "destructive",
    },
    {
      title: "Low Stock Items",
      description: "Items approaching reorder point",
      icon: TrendingDown,
      href: "/dashboard/purchasing/inventory?status=LOW",
      count: stats?.lowStockItems,
    },
    {
      title: "Purchase Orders",
      description: "View and manage POs",
      icon: FileText,
      href: "/dashboard/purchasing/orders",
      count: stats?.openPurchaseOrders,
    },
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Purchasing
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage reorders, purchase orders, and suppliers
            </p>
          </div>
          {/* <Button
            onClick={() => router.push("/dashboard/purchasing/orders/create")}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Purchase Order
          </Button> */}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Pending Reorders
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-200">
                    {stats?.pendingReorders || 0}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                  <ShoppingCart className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Critical Items
                  </p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {stats?.criticalItems || 0}
                  </p>
                </div>
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                  <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Open POs
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-200">
                    {stats?.openPurchaseOrders || 0}
                  </p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                  <FileText className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Est. Value
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-200">
                    ${stats?.estimatedValue.toLocaleString() || 0}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                  <DollarSign className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action) => (
              <Card
                key={action.href}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => router.push(action.href)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className={`p-3 rounded-full ${
                        action.variant === "destructive"
                          ? "bg-red-100 dark:bg-red-900/30"
                          : "bg-blue-100 dark:bg-blue-900/30"
                      }`}
                    >
                      <action.icon
                        className={`w-5 h-5 ${
                          action.variant === "destructive"
                            ? "text-red-600 dark:text-red-400"
                            : "text-blue-600 dark:text-blue-400"
                        }`}
                      />
                    </div>
                    {action.count !== undefined && (
                      <Badge
                        variant={
                          action.variant === "destructive"
                            ? "destructive"
                            : "default"
                        }
                      >
                        {action.count}
                      </Badge>
                    )}
                  </div>
                  <h3 className="font-semibold mb-1">{action.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {action.description}
                  </p>
                  <div className="mt-3 flex items-center text-sm text-blue-600 dark:text-blue-400">
                    View <ArrowRight className="w-4 h-4 ml-1" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Recent Reorder Requests */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Recent Reorder Requests</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/dashboard/purchasing/reorders")}
              >
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentRequests === undefined ? (
              // Loading skeleton
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-zinc-900 rounded-lg animate-pulse"
                  >
                    <div className="flex-1">
                      <div className="h-5 bg-gray-200 dark:bg-zinc-800 rounded w-3/4 mb-2"></div>
                      <div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-1/2"></div>
                    </div>
                    <div className="text-right">
                      <div className="h-4 bg-gray-200 dark:bg-zinc-800 rounded w-20 mb-2"></div>
                      <div className="h-3 bg-gray-200 dark:bg-zinc-800 rounded w-16"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : recentRequests.length > 0 ? (
              // Actual data
              <div className="space-y-3">
                {recentRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-zinc-900 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{request.productName}</div>
                        {request.hasBeenOrdered && (
                          <Badge
                            variant="secondary"
                            className="text-xs font-normal bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-200"
                          >
                            PO Created
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        SKU: {request.sku} • Current: {request.currentStock}{" "}
                        units
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        Order: {request.suggestedQuantity}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(request.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Empty state
              <div className="text-center py-8 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No recent reorder requests</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
