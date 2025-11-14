"use client";

import React, { useState, useEffect } from "react";
import {
  Package,
  ShoppingCart,
  Truck,
  Loader2,
  ClipboardCheck,
  ListCheck,
  User,
  Bell,
  FileText,
  MapPin,
  ArrowLeftRight,
  ShoppingBag,
  CalendarDays,
  ScanBarcode,
  ClipboardList,
  PackageCheck,
  RefreshCcw,
  Settings,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateItemModal } from "@/components/modal/CreateItemModal";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { getActivityIcon } from "@/lib/activity-utils";

export default function Dashboard(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Check if mobile on mount and resize
  useEffect(() => {
    setMounted(true);

    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 468);
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);

    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/stats");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: activity } = useQuery({
    queryKey: ["dashboard-activity"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/activity?limit=20");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const { data: lowStockItems } = useQuery({
    queryKey: ["dashboard-low-stock"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/low-stock");
      return res.json();
    },
    refetchInterval: 60000,
  });

  // ✅ Fixed: Use nullish coalescing for each property
  const displayStats = {
    totalProducts: stats?.totalProducts ?? 0,
    lowStock: stats?.lowStock ?? 0,
    pendingOrders: stats?.pendingOrders ?? 0,
    todayShipments: stats?.todayShipments ?? 0,
    ordersToPick: stats?.ordersToPick ?? 0,
    ordersToPack: stats?.ordersToPack ?? 0,
    ordersToShip: stats?.ordersToShip ?? 0,
  };

  const displayActivity = activity || [];
  const displayLowStockItems = lowStockItems || [];

  // Prevent hydration mismatch
  if (!mounted) {
    return <DesktopDashboard />;
  }

  // Show mobile dashboard on small screens
  if (isMobile) {
    return <MobileDashboard stats={displayStats} />;
  }

  // Desktop Dashboard
  return (
    <DesktopDashboard
      displayStats={displayStats}
      displayActivity={displayActivity}
      displayLowStockItems={displayLowStockItems}
      activity={activity}
      lowStockItems={lowStockItems}
      router={router}
      createOpen={createOpen}
      setCreateOpen={setCreateOpen}
    />
  );
}

// ============================================
// MOBILE DASHBOARD COMPONENT
// ============================================
function MobileDashboard({ stats }: { stats: any }) {
  const menuItems = [
    {
      icon: ListCheck,
      label: "Inventory",
      href: "/dashboard/inventory",
    },
    {
      icon: ShoppingCart,
      label: "Orders",
      href: "/dashboard/orders",
    },
    {
      icon: User,
      label: "My Work",
      href: "/dashboard/my-work",
    },
    {
      icon: Bell,
      label: "Notifications",
      href: "/dashboard/notifications",
    },
    {
      icon: ClipboardList,
      label: "Picking",
      href: "/dashboard/picking",
    },
    {
      icon: PackageCheck,
      label: "Packing",
      href: "/dashboard/packing",
    },
    {
      icon: Truck,
      label: "Shipping",
      href: "/dashboard/shipping",
    },
    {
      icon: ScanBarcode,
      label: "Receiving",
      href: "/dashboard/inventory/receive/po",
    },
    {
      icon: Undo2,
      label: "Returns",
      href: "/dashboard/inventory/returns",
    },
    {
      icon: MapPin,
      label: "Locations",
      href: "/dashboard/locations/print-labels",
    },
    {
      icon: ArrowLeftRight,
      label: "Transfers",
      href: "/dashboard/inventory/transfers",
    },
    {
      icon: ShoppingBag,
      label: "Backorders",
      href: "/dashboard/backorders",
    },
    {
      icon: CalendarDays,
      label: "Planner",
      href: "/dashboard/inventory-planner",
    },
    {
      icon: RefreshCcw,
      label: "Cycle Count",
      href: "/dashboard/inventory/count",
    },
    {
      icon: FileText,
      label: "POs",
      href: "/dashboard/inventory/receive/po",
    },
    {
      icon: Settings,
      label: "Settings",
      href: "/dashboard/settings",
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Stats Summary */}
      <div className="px-4 py-4 bg-card border-b border-border">
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">
              {stats.ordersToPick || stats.pendingOrders}
            </div>
            <div className="text-xs text-muted-foreground">To Pick</div>
          </div>
          <div className="text-center border-l border-r border-border">
            <div className="text-2xl font-bold text-foreground">
              {stats.ordersToPack}
            </div>
            <div className="text-xs text-muted-foreground">To Pack</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">
              {stats.ordersToShip}
            </div>
            <div className="text-xs text-muted-foreground">To Ship</div>
          </div>
        </div>
      </div>

      {/* 2-Column Grid Menu */}
      <div className="p-4">
        <div className="grid grid-cols-3 gap-4">
          {menuItems.map((item, index) => (
            <Link
              key={index}
              href={item.href}
              className={`text-white bg-linear-to-br from-gray-100 to-white dark:from-zinc-800 dark:to-zinc-900 rounded-xl p-6 flex flex-col items-center justify-center 
                gap-3 active:scale-95 transform transition-transform border-2 border-gray-200 dark:border-zinc-800`}
            >
              <div className="p-2 rounded-full bg-gradient-to-tr from-violet-600 to-blue-700 text-white">
                <item.icon className="w-5 h-5" />
              </div>

              <span className="text-gray-400 text-xs whitespace-nowrap overflow-hidden text-ellipsis">
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================
// DESKTOP DASHBOARD COMPONENT
// ============================================
function DesktopDashboard({
  displayStats,
  displayActivity,
  displayLowStockItems,
  activity,
  lowStockItems,
  router,
  createOpen,
  setCreateOpen,
}: any) {
  return (
    <div className="min-h-screen bg-background">
      <div className="space-y-6 pt-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Products
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {displayStats?.totalProducts?.toLocaleString() ?? "0"}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Low Stock Items
              </CardTitle>
              <Badge variant="destructive" className="text-xs">
                {displayStats?.lowStock ?? 0}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-400">
                {displayStats?.lowStock ?? 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Requires attention
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Orders to Pick
              </CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {displayStats?.ordersToPick || displayStats?.pendingOrders || 0}
              </div>
              <p className="text-xs text-muted-foreground">Ready for picking</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Today's Shipments
              </CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {displayStats?.todayShipments ?? 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Workflow Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center">
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  To Pick
                </span>
                <Badge variant="secondary">
                  {displayStats?.ordersToPick || 0}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Orders allocated and ready for picking
              </p>
              <Link href="/dashboard/picking">
                <Button
                  variant={"outline"}
                  size="sm"
                  className="w-full cursor-pointer"
                >
                  Start Picking
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center">
                  <Package className="w-4 h-4 mr-2" />
                  To Pack
                </span>
                <Badge variant="secondary">
                  {displayStats?.ordersToPack || 0}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Picked orders ready for packing
              </p>
              <Link href="/dashboard/packing">
                <Button
                  size="sm"
                  className="w-full cursor-pointer"
                  variant="outline"
                >
                  Pack Orders
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center">
                  <Truck className="w-4 h-4 mr-2" />
                  To Ship
                </span>
                <Badge variant="secondary">
                  {displayStats?.ordersToShip || 0}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Packed orders ready for shipping
              </p>
              <Link href="/dashboard/shipping">
                <Button
                  size="sm"
                  className="w-full cursor-pointer"
                  variant="outline"
                >
                  Create Labels
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <Card className="xl:max-h-[600px] overflow-y-scroll">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Recent Activity
                <Badge variant="outline">{displayActivity?.length || 0}</Badge>
              </CardTitle>
              <CardDescription>Latest warehouse operations</CardDescription>
            </CardHeader>
            <CardContent>
              {!activity ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : displayActivity.length > 0 ? (
                <>
                  <div className="space-y-4">
                    {displayActivity.map((activity: any) => (
                      <div
                        key={activity.id}
                        className="flex items-start space-x-3"
                      >
                        {getActivityIcon(activity.type)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 dark:text-gray-200">
                            {activity.message}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {activity.time}
                            {activity.userName && (
                              <span className="ml-1 text-blue-500">
                                • by {activity.userName}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    className="w-full mt-4"
                    onClick={() => router?.push("/dashboard/activity")}
                  >
                    View All
                  </Button>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">No recent activity</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Low Stock Items */}
          <Card className="xl:max-h-[600px] overflow-y-scroll">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Low Stock Items
                <Badge variant="outline">
                  {displayLowStockItems?.length || 0}
                </Badge>
              </CardTitle>
              <CardDescription>Items below minimum threshold</CardDescription>
            </CardHeader>
            <CardContent>
              {!lowStockItems ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : displayLowStockItems.length > 0 ? (
                <>
                  <div className="space-y-3">
                    {displayLowStockItems.map((item: any) => (
                      <div
                        key={item.sku}
                        className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-rose-200 dark:border-rose-800"
                      >
                        <div>
                          <p className="font-medium text-sm">{item.name}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            SKU: {item.sku} • {item.location}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-red-600 dark:text-red-400">
                            {item.current}/{item.minimum}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Current/Min
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    className="w-full mt-4"
                    onClick={() =>
                      router?.push(
                        "/dashboard/purchasing/inventory?status=CRITICAL"
                      )
                    }
                  >
                    View All
                  </Button>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">All items are well stocked</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions - Core WMS Operations */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Core warehouse operations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Pick Orders */}
              <Link href="/dashboard/picking">
                <Button
                  variant="outline"
                  className="h-20 flex-col w-full cursor-pointer"
                >
                  <ShoppingCart className="w-6 h-6 mb-2" />
                  <span className="text-sm">Pick Orders</span>
                </Button>
              </Link>

              {/* Pack Orders */}
              <Link href="/dashboard/packing">
                <Button
                  variant="outline"
                  className="h-20 flex-col w-full cursor-pointer"
                >
                  <Package className="w-6 h-6 mb-2" />
                  <span className="text-sm">Pack Orders</span>
                </Button>
              </Link>

              {/* Receive Items */}
              <Link href="/dashboard/inventory/receive">
                <Button
                  variant="outline"
                  className="h-20 flex-col w-full cursor-pointer"
                >
                  <ScanBarcode className="w-6 h-6 mb-2" />
                  <span className="text-sm">Receive Stock</span>
                </Button>
              </Link>

              {/* Cycle Count */}
              <Link href="/dashboard/inventory/count">
                <Button
                  variant="outline"
                  className="h-20 flex-col w-full cursor-pointer"
                >
                  <ClipboardCheck className="w-6 h-6 mb-2" />
                  <span className="text-sm">Cycle Count</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Item Modal */}
      <CreateItemModal open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
