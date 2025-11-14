"use client";

import { useRouter } from "next/navigation";
import { TrendingUp, ShoppingCart, Package, AlertTriangle } from "lucide-react";
import Image from "next/image";

export default function InventoryPlannerDashboard(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const router = useRouter();

  const cards = [
    {
      title: "Forecast & Replenishment",
      description: "View stock forecasts and replenishment recommendations",
      icon: TrendingUp,
      color: "blue",
      href: "/dashboard/inventory-planner/forecasts",
      stats: "3,491 products",
    },
    {
      title: "Purchase Orders",
      description: "Manage and track purchase orders",
      icon: ShoppingCart,
      color: "green",
      href: "/dashboard/inventory-planner/purchase-orders",
      stats: "Active orders",
    },
    {
      title: "Low Stock Alerts",
      description: "Products requiring immediate attention",
      icon: AlertTriangle,
      color: "red",
      href: "/dashboard/inventory-planner/forecasts?filter=low-stock",
      stats: "Urgent items",
    },
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, string> = {
      blue: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
      green:
        "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
      red: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
      purple:
        "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-foreground">
            Inventory Planner
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage forecasts, purchase orders, and inventory planning
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.href}
                onClick={() => router.push(card.href)}
                className="cursor-pointer bg-white dark:bg-card rounded-lg shadow dark:shadow-lg hover:shadow-lg dark:hover:shadow-xl transition-all p-6 text-left group border dark:border-border"
              >
                <div
                  className={`p-3 rounded-lg w-fit mb-4 ${getColorClasses(
                    card.color
                  )}`}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-500 transition-colors">
                  {card.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {card.description}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  {card.stats}
                </p>
              </button>
            );
          })}
        </div>

        {/* Recent Activity */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Quick Actions */}
          <div className="bg-white dark:bg-card rounded-lg shadow dark:shadow-lg p-6 border dark:border-border">
            <h2 className="text-lg font-semibold mb-4 text-foreground">
              Quick Actions
            </h2>
            <div className="space-y-3">
              <button
                onClick={() =>
                  router.push(
                    "/dashboard/inventory-planner/forecasts?filter=low-stock"
                  )
                }
                className="cursor-pointer w-full text-left px-4 py-3 border dark:border-border rounded-lg hover:bg-gray-50 dark:hover:bg-accent transition-colors flex items-center gap-3"
              >
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <div>
                  <p className="font-medium text-foreground">
                    View Low Stock Items
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Products running low
                  </p>
                </div>
              </button>
              <button
                onClick={() =>
                  router.push(
                    "/dashboard/inventory-planner/forecasts?filter=reorder"
                  )
                }
                className="cursor-pointer w-full text-left px-4 py-3 border dark:border-border rounded-lg hover:bg-gray-50 dark:hover:bg-accent transition-colors flex items-center gap-3"
              >
                <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="font-medium text-foreground">
                    Reorder Recommendations
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Items to reorder
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Info Card */}
          <div className="relative overflow-hidden rounded-lg">
            <Image
              src="/images/inventory-planner-main.webp"
              fill
              className="object-cover"
              alt="Inventory planning and forecasting"
            />

            {/* 🔹 Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-800 via-black/30 to-transparent flex items-end">
              <p className="text-gray-200 text-md sm:text-lg font-semibold p-4">
                Real-time updates from Inventory Planner
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
