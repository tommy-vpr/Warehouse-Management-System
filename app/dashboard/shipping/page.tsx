"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Truck,
  Package,
  Download,
  ExternalLink,
  Search,
  Loader2,
  Calendar,
  DollarSign,
} from "lucide-react";
import { CarrierBadge } from "@/components/CarrierBadge";

interface ShippedOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  shippedAt: string;
  status: string;
  packages: Array<{
    id: string;
    trackingNumber: string;
    carrierCode: string;
    serviceCode: string;
    labelUrl: string;
    cost: string;
  }>;
  totalCost: number;
  packageCount: number;
}

export default function ShippingDashboard(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [mounted, setMounted] = useState(false);

  useState(() => {
    setMounted(true);
  });

  const { data: orders, isLoading } = useQuery<ShippedOrder[]>({
    queryKey: ["shipped-orders", dateFilter],
    queryFn: async () => {
      const res = await fetch(`/api/shipping/orders?period=${dateFilter}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const filteredOrders = orders?.filter(
    (order) =>
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.packages.some((pkg) =>
        pkg.trackingNumber.toLowerCase().includes(searchTerm.toLowerCase())
      )
  );

  const stats = {
    totalShipped: orders?.length || 0,
    todayShipped:
      orders?.filter((o) => {
        const shipDate = new Date(o.shippedAt);
        const today = new Date();
        return shipDate.toDateString() === today.toDateString();
      }).length || 0,
    totalPackages: orders?.reduce((sum, o) => sum + o.packageCount, 0) || 0,
    totalCost:
      orders?.reduce((sum, o) => sum + o.totalCost, 0).toFixed(2) || "0.00",
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600 dark:text-gray-400">
            Loading shipments...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Shipping Dashboard
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
            View and manage shipped orders
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <Card>
            <CardContent className="p-3 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    Total Shipped
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.totalShipped}
                  </p>
                </div>
                <Truck className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    Today
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.todayShipped}
                  </p>
                </div>
                <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-2 sm:col-span-1">
            <CardContent className="p-3 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    Packages
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.totalPackages}
                  </p>
                </div>
                <Package className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          {/* Optional: Uncomment to show total cost */}
          {/* <Card className="col-span-2 sm:col-span-1">
            <CardContent className="p-3 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    Total Cost
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                    ${stats.totalCost}
                  </p>
                </div>
                <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-orange-600" />
              </div>
            </CardContent>
          </Card> */}
        </div>

        {/* Filters */}
        <Card className="mb-4 sm:mb-6">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col gap-2 sm:gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search order, customer, tracking..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 text-sm dark:border-zinc-700"
                />
              </div>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Orders List */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl">
              Shipped Orders ({filteredOrders?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            {filteredOrders && filteredOrders.length > 0 ? (
              <div className="space-y-3 sm:space-y-4">
                {filteredOrders.map((order) => (
                  <div
                    key={order.id}
                    className="border border-gray-200 dark:border-zinc-700 rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow"
                  >
                    {/* Desktop Layout */}
                    <div className="hidden lg:block">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                            {order.orderNumber}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {order.customerName}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500">
                            Shipped:{" "}
                            {new Date(order.shippedAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            className="cursor-pointer"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              router.push(
                                `/dashboard/shipping/tracking/${order.id}`
                              )
                            }
                          >
                            <ExternalLink className="w-4 h-4 mr-1" />
                            View Details
                          </Button>
                        </div>
                      </div>

                      {/* Packages */}
                      <div className="space-y-2">
                        {order.packages.map((pkg) => (
                          <div
                            key={pkg.id}
                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-zinc-900 rounded border border-gray-200 dark:border-zinc-700"
                          >
                            <div className="flex items-center gap-3">
                              <Package className="w-4 h-4 text-gray-400" />
                              <div>
                                <p className="font-mono text-sm text-gray-900 dark:text-white">
                                  {pkg.trackingNumber}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <CarrierBadge carrierCode={pkg.carrierCode} />
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    ${pkg.cost}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                window.open(pkg.labelUrl, "_blank")
                              }
                              className="cursor-pointer"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                          {order.packageCount} package
                          {order.packageCount > 1 ? "s" : ""}
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          Total: ${order.totalCost.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Mobile Layout */}
                    <div className="lg:hidden space-y-3">
                      {/* Header */}
                      <div>
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-base text-gray-900 dark:text-white">
                            {order.orderNumber}
                          </h3>
                          <Badge
                            variant="outline"
                            className="text-xs flex-shrink-0"
                          >
                            {order.packageCount} pkg
                            {order.packageCount > 1 ? "s" : ""}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {order.customerName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          {mounted
                            ? new Date(order.shippedAt).toLocaleString()
                            : order.shippedAt}
                        </p>
                      </div>

                      {/* Packages */}
                      <div className="space-y-2">
                        {order.packages.map((pkg) => (
                          <div
                            key={pkg.id}
                            className="p-3 bg-gray-50 dark:bg-zinc-900 rounded border border-gray-200 dark:border-zinc-700"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-start gap-2 flex-1 min-w-0">
                                <Package className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-mono text-xs text-gray-900 dark:text-white break-all">
                                    {pkg.trackingNumber}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <CarrierBadge
                                      carrierCode={pkg.carrierCode}
                                    />
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                      ${pkg.cost}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  window.open(pkg.labelUrl, "_blank")
                                }
                                className="cursor-pointer flex-shrink-0 h-8 w-8 p-0"
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200 dark:border-zinc-700">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          Total: ${order.totalCost.toFixed(2)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            router.push(
                              `/dashboard/shipping/tracking/${order.id}`
                            )
                          }
                          className="cursor-pointer"
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
                          Details
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 sm:py-12">
                <Truck className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No shipped orders
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {searchTerm
                    ? "No orders match your search"
                    : "No orders have been shipped yet"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
