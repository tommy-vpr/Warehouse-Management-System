// components/packing/PackingTaskProgressView.tsx
"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Package,
  MapPin,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  ArrowRight,
  Loader2,
  PlayCircle,
  PauseCircle,
  SkipForward,
  Box,
  ShoppingCart,
  Weight,
} from "lucide-react";
import { useRouter } from "next/navigation";

// Helper functions for formatting
const formatCurrency = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) return "$0.00";
  return `$${Number(value).toFixed(2)}`;
};

const formatWeight = (
  weight: number | string | null | undefined,
  quantity: number = 1
): string => {
  if (weight === null || weight === undefined) return "0.00";
  return ((Number(weight) * quantity) / 1000).toFixed(2);
};

interface PackingTaskProgressProps {
  taskId: string;
}

interface PackingTaskItem {
  id: string;
  sequence: number;
  status: string;
  order: {
    id: string;
    orderNumber: string;
    customerName: string;
    customerEmail?: string;
    totalAmount: number | string;
  };
  product: {
    id: string;
    sku: string;
    name: string;
    brand?: string;
    upc?: string;
    barcode?: string;
    weight?: number | string;
    dimensions?: any;
  } | null;
  location: {
    id: string;
    name: string;
    zone?: string;
    warehouseNumber?: number;
    aisle?: string;
    bay?: number;
    tier?: string;
  } | null;
  quantityRequired: number;
  quantityCompleted: number;
  completedAt?: string;
  completedBy?: {
    id: string;
    name: string | null;
    email: string;
  };
  notes?: string;
}

interface PackingTaskStats {
  totalItems: number;
  completedItems: number;
  progress: number;
  pendingItems: number;
  inProgressItems: number;
  completedItemsCount: number;
  skippedItems: number;
  issueItems: number;
  estimatedTimeRemaining: number;
  elapsedTime: number;
  totalOrders: number;
  completedOrders: number;
  uniqueOrders: string[];
  uniqueCustomers: string[];
  totalValue: number;
  totalWeight: number;
}

interface PackingTaskData {
  task: {
    id: string;
    taskNumber: string;
    status: string;
    priority: number;
    assignedTo?: {
      id: string;
      name: string | null;
      email: string;
    };
    assignedAt?: string;
    startedAt?: string;
    completedAt?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
  };
  items: PackingTaskItem[];
  stats: PackingTaskStats;
  events?: any[];
}

export default function PackingTaskProgressView({
  taskId,
}: PackingTaskProgressProps) {
  const router = useRouter();

  // Fetch packing task details with auto-refresh
  const { data, isLoading, error, refetch } = useQuery<PackingTaskData>({
    queryKey: ["packingTask", taskId],
    queryFn: async () => {
      const response = await fetch(`/api/packing-tasks/${taskId}`);
      if (!response.ok) throw new Error("Failed to fetch packing task");
      return response.json();
    },
    refetchInterval: 10000, // Refresh every 10 seconds
    refetchOnWindowFocus: true,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ASSIGNED":
      case "PENDING":
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
      case "IN_PROGRESS":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "COMPLETED":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "SKIPPED":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
      case "ISSUE":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "PAUSED":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
      case "PARTIALLY_COMPLETED":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  const getPriorityBadge = (priority: number) => {
    if (priority === 2) {
      return (
        <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
          Urgent
        </Badge>
      );
    }
    if (priority === 1) {
      return (
        <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
          High
        </Badge>
      );
    }
    return null;
  };

  const handleStartPacking = () => {
    // Find the first order with pending items
    const firstPendingItem = items.find(
      (item) => item.status === "PENDING" || item.status === "IN_PROGRESS"
    );

    if (firstPendingItem) {
      router.push(`/dashboard/packing/pack/${firstPendingItem.order.id}`);
    } else {
      // If no pending items, go to the first order
      const firstOrder = items[0]?.order.id;
      if (firstOrder) {
        router.push(`/dashboard/packing/pack/${firstOrder}`);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600 dark:text-gray-400">
            Loading Packing Progress...
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            Error Loading Packing Task
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
          <Button onClick={() => refetch()}>Retry</Button>
        </div>
      </div>
    );
  }

  const { task, items, stats } = data;
  const hasStarted = !!task.startedAt || stats.completedItems > 0;
  const isCompleted = task.status === "COMPLETED";

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl sm:text-3xl font-bold">
              {task.taskNumber}
            </h1>
            {getPriorityBadge(task.priority)}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {task.assignedTo?.name
              ? `Assigned to ${task.assignedTo.name}`
              : "Unassigned"}
          </p>
        </div>
        <Badge className={getStatusColor(task.status)}>
          {task.status.replace(/_/g, " ")}
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Package className="w-5 h-5 text-blue-600 mr-2" />
              <div>
                <p className="text-lg font-bold">
                  {stats.completedItems}/{stats.totalItems}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Items
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              <div>
                <p className="text-lg font-bold">{stats.progress}%</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Complete
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Clock className="w-5 h-5 text-orange-600 mr-2" />
              <div>
                <p className="text-lg font-bold">{stats.pendingItems}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Pending
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <ShoppingCart className="w-5 h-5 text-purple-600 mr-2" />
              <div>
                <p className="text-lg font-bold">
                  {stats.completedOrders}/{stats.totalOrders}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Orders
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
              <div>
                <p className="text-lg font-bold">{stats.issueItems}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Issues
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Weight className="w-5 h-5 text-indigo-600 mr-2" />
              <div>
                <p className="text-lg font-bold">
                  {(Number(stats.totalWeight) / 1000).toFixed(1)}kg
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Weight
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Overall Progress</span>
            <span className="text-sm font-bold">{stats.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${stats.progress}%` }}
            />
          </div>
          <div className="flex justify-between items-center mt-2 text-xs text-gray-600 dark:text-gray-400">
            <span>
              {task.startedAt
                ? `Started ${new Date(task.startedAt).toLocaleTimeString()}`
                : "Not started"}
            </span>
            {stats.estimatedTimeRemaining > 0 && !isCompleted && (
              <span>~{stats.estimatedTimeRemaining} min remaining</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      {!isCompleted && (
        <div className="flex gap-3">
          <Button
            onClick={handleStartPacking}
            className="flex-1 sm:flex-none"
            size="lg"
          >
            <PlayCircle className="w-5 h-5 mr-2" />
            {hasStarted ? "Continue Packing" : "Start Packing"}
          </Button>
          {hasStarted && (
            <Button variant="outline" size="lg">
              <PauseCircle className="w-5 h-5 mr-2" />
              Pause
            </Button>
          )}
        </div>
      )}

      {/* Packing Task Items */}
      <Card>
        <CardHeader>
          <CardTitle>Packing Task Items ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((item, index) => (
              <PackingTaskItemCard
                key={item.id}
                item={item}
                index={index + 1}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Individual Packing Task Item Card
function PackingTaskItemCard({
  item,
  index,
}: {
  item: PackingTaskItem;
  index: number;
}) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "border-green-500 bg-green-50 dark:bg-green-900/10";
      case "ISSUE":
        return "border-red-500 bg-red-50 dark:bg-red-900/10";
      case "SKIPPED":
        return "border-purple-500 bg-purple-50 dark:bg-purple-900/10";
      case "IN_PROGRESS":
        return "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10";
      default:
        return "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "ISSUE":
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case "SKIPPED":
        return <SkipForward className="w-5 h-5 text-purple-600" />;
      case "IN_PROGRESS":
        return <PlayCircle className="w-5 h-5 text-yellow-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const progress =
    item.quantityRequired > 0
      ? (item.quantityCompleted / item.quantityRequired) * 100
      : 0;

  if (!item.product) {
    return null;
  }

  return (
    <div
      className={`border-2 rounded-lg p-4 transition-all ${getStatusColor(
        item.status
      )}`}
    >
      <div className="flex items-start gap-4">
        {/* Sequence Number */}
        <div className="flex-shrink-0">
          <Badge variant="outline">{index}</Badge>
        </div>

        {/* Item Details */}
        <div className="flex-1 min-w-0">
          {/* Product Info */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                {item.product.name}
              </h4>
              <div className="flex flex-wrap gap-2 text-sm text-gray-600 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <Package className="w-4 h-4" />
                  SKU: {item.product.sku}
                </span>
                {item.product.brand && (
                  <span className="flex items-center gap-1">
                    Brand: {item.product.brand}
                  </span>
                )}
                {item.product.upc && (
                  <span className="flex items-center gap-1">
                    UPC: {item.product.upc}
                  </span>
                )}
              </div>
            </div>
            {getStatusIcon(item.status)}
          </div>

          {/* Location */}
          {item.location && (
            <div className="flex items-center gap-2 mb-2 text-sm">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {item.location.name}
              </span>
              {item.location.zone && (
                <span className="text-gray-500 dark:text-gray-400">
                  Zone: {item.location.zone}
                </span>
              )}
            </div>
          )}

          {/* Quantity */}
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                Quantity:{" "}
              </span>
              <span className="font-semibold">
                {item.quantityCompleted}/{item.quantityRequired}
              </span>
            </div>
            {item.status !== "PENDING" && (
              <Badge variant="outline">{item.status.replace(/_/g, " ")}</Badge>
            )}
          </div>

          {/* Progress Bar */}
          {item.quantityCompleted > 0 && (
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
              <div
                className={`h-2 rounded-full ${
                  progress === 100
                    ? "bg-green-500"
                    : item.status === "ISSUE"
                    ? "bg-red-500"
                    : "bg-blue-500"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* Order Reference */}
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>Order: {item.order.orderNumber}</span>
            <ArrowRight className="w-3 h-3" />
            <span>{item.order.customerName}</span>
          </div>

          {/* Additional Info */}
          {(item.notes || item.completedBy) && (
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              {item.completedBy && (
                <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 mb-1">
                  <User className="w-3 h-3" />
                  <span>
                    Packed by {item.completedBy.name || item.completedBy.email}
                  </span>
                  {item.completedAt && (
                    <span className="ml-2">
                      at {new Date(item.completedAt).toLocaleString()}
                    </span>
                  )}
                </div>
              )}
              {item.notes && (
                <div className="text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 rounded px-2 py-1">
                  Note: {item.notes}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
