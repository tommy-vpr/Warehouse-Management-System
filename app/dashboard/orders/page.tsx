"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  Search,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Truck,
  ShoppingCart,
  Loader2,
  SquareArrowOutUpRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import Link from "next/link";
import { InsufficientInventoryItem } from "@/lib/reserveInventory";
import InsufficientInventoryModal from "@/components/InsufficientInventoryModal";
import { useRouter } from "next/navigation";
import { OrdersTableSkeleton } from "@/components/skeleton/Orders";
import { OrderStatus } from "@/types/order";

interface OrderItem {
  id: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
}

interface NextAction {
  action: string;
  label: string;
  variant: "default" | "outline" | "destructive";
}

interface PickListInfo {
  pickListId: string;
  batchNumber: string;
  pickStatus: string;
  assignedTo?: string;
  startTime?: string;
  pickedItems: number; // ✅ NEW
  totalItems: number; // ✅ NEW
  hasStarted: boolean; // ✅ NEW
}

interface ManagementOrder {
  id: string;
  orderNumber: string;
  shopifyOrderId?: string;
  customerName: string;
  customerEmail: string;
  status: string;
  totalAmount: string;
  itemCount: number;
  totalWeight: number;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  createdAt: string;
  updatedAt: string;
  shippingLocation: {
    city: string;
    state: string;
    country: string;
  };
  pickListInfo?: PickListInfo;
  nextActions: NextAction[];
  items: OrderItem[];
}

interface OrderStats {
  total: number;
  pending: number;
  allocated: number;
  picking: number;
  picked: number;
  packed: number;
  shipped: number;
  fulfilled: number;
  urgent: number;
  high: number;
}

interface OrdersResponse {
  orders: ManagementOrder[];
  stats: OrderStats;
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

interface OrderFilters {
  status?: OrderStatus | "ALL";
  search?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | "ALL";
}

interface OrderActionRequest {
  action: string;
  orderId?: string;
  orderIds?: string[];
}

// API Functions
const fetchOrders = async (
  params: OrderFilters & { page?: number; limit?: number }
): Promise<OrdersResponse> => {
  const searchParams = new URLSearchParams();
  if (params.status && params.status !== "ALL")
    searchParams.set("status", params.status);
  if (params.search) searchParams.set("search", params.search);
  if (params.priority && params.priority !== "ALL")
    searchParams.set("priority", params.priority);

  searchParams.set("page", (params.page || 1).toString());
  searchParams.set("limit", (params.limit || 20).toString());

  const response = await fetch(`/api/orders/management?${searchParams}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch orders: ${response.status}`);
  }
  return response.json();
};

const performOrderAction = async (request: OrderActionRequest) => {
  const response = await fetch("/api/orders/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || `Failed to perform action: ${response.status}`
    );
  }

  return data;
};

// Custom hook for order actions
const useOrderAction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: performOrderAction,
    onSuccess: () => {
      // Invalidate and refetch orders data after successful action
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Order action failed";
      console.error("Order action failed:", message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });
};

export default function OrdersManagementDashboard(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<OrderFilters["status"]>("ALL");
  const [priorityFilter, setPriorityFilter] =
    useState<OrderFilters["priority"]>("ALL");

  const [currentPage, setCurrentPage] = useState(1);

  // UI states
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  // ✅ NEW: Track which order action is currently loading
  const [loadingAction, setLoadingAction] = useState<{
    orderId: string;
    action: string;
  } | null>(null);

  // TanStack Query hooks
  const { data, isLoading, isError, error, isFetching, refetch } = useQuery({
    queryKey: ["orders", statusFilter, searchTerm, priorityFilter, currentPage],
    queryFn: () =>
      fetchOrders({
        status: statusFilter,
        search: searchTerm,
        priority: priorityFilter,
        page: currentPage,
        limit: 20,
      }),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const orderActionMutation = useOrderAction();

  const router = useRouter();

  const [insufficientModal, setInsufficientModal] = useState<{
    items: InsufficientInventoryItem[];
    orderNumber: string;
    orderId: string;
  } | null>(null);

  // Extract data with defaults
  const orders = data?.orders ?? [];
  const stats = data?.stats;

  const totalPages = data?.totalPages || 1;
  const totalCount = data?.totalCount || 0;
  const isFiltering = isFetching && data !== undefined;

  const handleOrderAction = async (action: string, orderId: string) => {
    setLoadingAction({ orderId, action });

    try {
      if (action === "ALLOCATE") {
        // Allocate inventory
        const response = await fetch("/api/orders/allocate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, action: "check" }),
        });

        const data = await response.json();

        if (!response.ok && data.error === "INSUFFICIENT_INVENTORY") {
          const order = orders.find((o) => o.id === orderId);
          setInsufficientModal({
            items: data.insufficientItems,
            orderNumber: order?.orderNumber || "",
            orderId,
          });
          setLoadingAction(null);
          return;
        }

        await refetch();
        toast({
          title: "Success",
          description: "Inventory allocated successfully",
          variant: "success",
        });
      } else if (action === "GENERATE_SINGLE_PICK") {
        const response = await fetch("/api/picking/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderIds: [orderId],
            pickingStrategy: "SINGLE",
            priority: "FIFO",
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to generate pick list");
        }

        await refetch();
        toast({
          title: "Success",
          description: `Pick list ${data.pickList.batchNumber} generated`,
          variant: "success",
        });
      }
      // ✅ UPDATED: Navigate to progress view instead of generic picking dashboard
      else if (action === "VIEW_PICK_PROGRESS") {
        const order = orders.find((o) => o.id === orderId);
        if (order?.pickListInfo?.pickListId) {
          router.push(
            `/dashboard/picking/progress/${order.pickListInfo.pickListId}`
          );
        } else {
          toast({
            title: "Error",
            description: "No pick list found for this order",
            variant: "destructive",
          });
        }
        return;
      } else if (action === "MOBILE_PICK") {
        const order = orders.find((o) => o.id === orderId);
        if (order?.pickListInfo?.pickListId) {
          router.push(
            `/dashboard/picking/mobile/${order.pickListInfo.pickListId}`
          );
        } else {
          toast({
            title: "Error",
            description: "No pick list found for this order",
            variant: "destructive",
          });
        }
        return;
      } else if (action === "PACK_ORDER") {
        router.push(`/dashboard/packing/pack/${orderId}`);
        return;
      } else if (action === "CREATE_LABEL") {
        router.push(`/dashboard/packing/pack/${orderId}`);
        return;
      } else if (action === "MARK_FULFILLED") {
        const response = await fetch("/api/orders/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "MARK_FULFILLED", orderId }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to mark as fulfilled");
        }

        await refetch();
        toast({
          title: "Success",
          description: "Order marked as fulfilled",
          variant: "success",
        });
      } else if (action === "VIEW_DETAILS" || action === "VIEW_TRACKING") {
        router.push(`/dashboard/orders/${orderId}`);
        return;
      } else {
        console.warn(`Unhandled action: ${action}`);
        toast({
          title: "Info",
          description: "This action is not yet implemented",
          variant: "warning",
        });
      }
    } catch (error) {
      console.error(`Failed to perform ${action}:`, error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : `Failed to perform ${action}`,
        variant: "destructive",
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleInsufficientAction = async (
    action: "count" | "backorder" | "cancel"
  ) => {
    // If cancel, just close the modal
    if (action === "cancel") {
      setInsufficientModal(null);
      return;
    }

    try {
      const apiAction =
        action === "count" ? "ALLOCATE_WITH_COUNT" : "ALLOCATE_WITH_BACKORDER";
      await orderActionMutation.mutateAsync({
        action: apiAction,
        orderId: insufficientModal!.orderId,
      });

      setInsufficientModal(null);
      toast({
        title: "Success",
        description:
          action === "count"
            ? "Cycle count tasks created"
            : "Back orders created and available inventory allocated",
        variant: "success",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const isActionLoading = (orderId: string, action: string) => {
    return (
      loadingAction?.orderId === orderId && loadingAction?.action === action
    );
  };

  const toggleOrderSelection = (orderId: string) => {
    const newSelection = new Set(selectedOrders);
    if (newSelection.has(orderId)) {
      newSelection.delete(orderId);
    } else {
      newSelection.add(orderId);
    }
    setSelectedOrders(newSelection);
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.PENDING:
        return "bg-gray-100 text-gray-800 dark:bg-gray-200 dark:text-gray-900";
      case OrderStatus.ALLOCATED:
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case OrderStatus.PICKING:
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case OrderStatus.PICKED:
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
      case OrderStatus.PACKED:
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
      case OrderStatus.SHIPPED:
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case OrderStatus.FULFILLED:
        return "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400";
      case OrderStatus.DELIVERED:
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
      case OrderStatus.CANCELLED:
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case OrderStatus.RETURNED:
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-500/30 dark:text-gray-300";
    }
  };

  const getPriorityColor = (priority: ManagementOrder["priority"]) => {
    switch (priority) {
      case "URGENT":
        return "bg-red-100 text-red-800 dark:bg-red-400 dark:text-red-900";
      case "HIGH":
        return "bg-red-100 text-red-800 dark:bg-red-400 dark:text-red-900";
      case "MEDIUM":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-400 dark:text-yellow-900";
      case "LOW":
        return "bg-green-100 text-green-800 dark:bg-green-400 dark:text-green-900";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-400 dark:text-gray-900";
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedOrders.size === 0) return;

    try {
      await orderActionMutation.mutateAsync({
        action,
        orderIds: Array.from(selectedOrders),
      });
      setSelectedOrders(new Set());
    } catch (error) {
      console.error(`Failed to perform bulk ${action}:`, error);
    }
  };

  // Error state
  if (isError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Error Loading Orders
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {error instanceof Error ? error.message : "An error occurred"}
          </p>
          <Button onClick={() => refetch()} className="cursor-pointer">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600 dark:text-gray-400">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4 sm:mb-8">
          <div className="flex justify-between items-center mb-4 sm:mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                Orders Management
              </h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                Central operations dashboard for all orders
              </p>
            </div>
            <div className="flex gap-2 sm:gap-3">
              {/* Desktop: Full button */}
              <Button
                variant="outline"
                onClick={() => refetch()}
                disabled={isFetching}
                className="hidden sm:flex"
              >
                <RefreshCw
                  className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`}
                />
                {isFetching ? "Refreshing..." : "Refresh"}
              </Button>
              {/* Mobile: Icon only */}
              <Button
                variant="outline"
                size="icon"
                onClick={() => refetch()}
                disabled={isFetching}
                className="sm:hidden"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          </div>

          {/* Statistics Cards */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-4 mb-4 sm:mb-6">
              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center">
                    <Package className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                    <div className="ml-2 sm:ml-3">
                      <p className="text-base sm:text-lg font-bold">
                        {stats.total}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Total
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center">
                    <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" />
                    <div className="ml-2 sm:ml-3">
                      <p className="text-base sm:text-lg font-bold">
                        {stats.urgent}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Urgent
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center">
                    <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600" />
                    <div className="ml-2 sm:ml-3">
                      <p className="text-base sm:text-lg font-bold">
                        {stats.picking}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Picking
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center">
                    <Package className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
                    <div className="ml-2 sm:ml-3">
                      <p className="text-base sm:text-lg font-bold">
                        {stats.picked}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Picked
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center">
                    <Truck className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                    <div className="ml-2 sm:ml-3">
                      <p className="text-base sm:text-lg font-bold">
                        {stats.shipped}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Shipped
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                    <div className="ml-2 sm:ml-3">
                      <p className="text-base sm:text-lg font-bold">
                        {stats.fulfilled}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Fulfilled
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-col gap-2 sm:gap-4 mb-4 sm:mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search orders, customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-gray-200 dark:border-zinc-700"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as OrderFilters["status"])
                }
                className="flex-1 text-xs px-3 py-2 border border-gray-300 dark:border-zinc-700 dark:text-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Status</option>
                <option value={OrderStatus.PENDING}>Pending</option>
                <option value={OrderStatus.ALLOCATED}>Allocated</option>
                <option value={OrderStatus.PICKING}>Picking</option>
                <option value={OrderStatus.PICKED}>Picked</option>
                <option value={OrderStatus.PACKED}>Packed</option>
                <option value={OrderStatus.SHIPPED}>Shipped</option>
                <option value={OrderStatus.FULFILLED}>Fulfilled</option>
                <option value={OrderStatus.CANCELLED}>Cancelled</option>
                <option value={OrderStatus.RETURNED}>Returned</option>
              </select>
              <select
                value={priorityFilter}
                onChange={(e) =>
                  setPriorityFilter(e.target.value as OrderFilters["priority"])
                }
                className="flex-1 text-xs px-3 py-2 border border-gray-300 dark:border-zinc-700 dark:text-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Priorities</option>
                <option value="URGENT">Urgent</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedOrders.size > 0 && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-blue-50 border border-blue-400 rounded-lg">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <span className="text-sm font-medium text-blue-900">
                  {selectedOrders.size} orders selected
                </span>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <Button
                    size="sm"
                    onClick={() => handleBulkAction("BULK_ALLOCATE")}
                    disabled={orderActionMutation.isPending}
                    className="cursor-pointer flex-1 sm:flex-none"
                  >
                    Allocate
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkAction("BULK_GENERATE_PICKS")}
                    disabled={orderActionMutation.isPending}
                    className="cursor-pointer flex-1 sm:flex-none"
                  >
                    Generate Picks
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedOrders(new Set())}
                    className="cursor-pointer w-full sm:w-auto"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Desktop: Table View */}
        <div className="hidden lg:block">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Orders ({orders.length})</span>
                <div className="flex items-center gap-4">
                  {isFetching && (
                    <span className="text-sm text-gray-500 flex items-center">
                      <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                      Updating...
                    </span>
                  )}
                  {selectedOrders.size > 0 && (
                    <span className="text-sm font-normal text-blue-600">
                      {selectedOrders.size} selected
                    </span>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-background border-b border-gray-200 dark:border-zinc-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <input
                          type="checkbox"
                          className="rounded"
                          checked={
                            selectedOrders.size === orders.length &&
                            orders.length > 0
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedOrders(
                                new Set(orders.map((o) => o.id))
                              );
                            } else {
                              setSelectedOrders(new Set());
                            }
                          }}
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Order
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Qty
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Value
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Location
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Details
                      </th>
                    </tr>
                  </thead>
                  {isFiltering ? (
                    <OrdersTableSkeleton />
                  ) : (
                    <tbody className="bg-background divide-y divide-gray-200 dark:divide-zinc-700">
                      {orders.map((order) => (
                        <React.Fragment key={order.id}>
                          <tr className="hover:bg-background">
                            <td className="px-4 py-4">
                              <input
                                type="checkbox"
                                className="rounded"
                                checked={selectedOrders.has(order.id)}
                                onChange={() => toggleOrderSelection(order.id)}
                              />
                            </td>
                            <td className="px-4 py-4">
                              <div>
                                <div className="font-medium">
                                  {order.orderNumber}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {new Date(
                                    order.createdAt
                                  ).toLocaleDateString()}
                                </div>
                                {/* ✅ NEW: Enhanced pick list info with progress */}
                                {order.pickListInfo && (
                                  <div className="mt-1">
                                    <div className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-2">
                                      <span>
                                        Pick: {order.pickListInfo.batchNumber}
                                      </span>
                                      {order.pickListInfo.hasStarted && (
                                        <Badge
                                          variant="outline"
                                          className="text-xs"
                                        >
                                          {order.pickListInfo.pickedItems}/
                                          {order.pickListInfo.totalItems}
                                        </Badge>
                                      )}
                                    </div>
                                    {/* Mini progress bar */}
                                    {order.pickListInfo.totalItems > 0 && (
                                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 mt-1">
                                        <div
                                          className="bg-blue-600 h-1 rounded-full transition-all"
                                          style={{
                                            width: `${
                                              (order.pickListInfo.pickedItems /
                                                order.pickListInfo.totalItems) *
                                              100
                                            }%`,
                                          }}
                                        />
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div>
                                <div className="font-medium">
                                  {order.customerName}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {order.customerEmail}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <Badge
                                className={getStatusColor(
                                  order.status as OrderStatus
                                )}
                              >
                                {order.status.replace("_", " ")}
                              </Badge>
                            </td>
                            <td className="px-4 py-4">
                              <div>
                                <div className="text-sm">
                                  {order.items.reduce(
                                    (sum, item) => sum + item.quantity,
                                    0
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="text-sm">
                                ${order.totalAmount}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="text-sm">
                                <div>{order.shippingLocation.city}</div>
                                <div className="text-gray-500">
                                  {order.shippingLocation.state}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex gap-1 flex-wrap">
                                {order.nextActions
                                  .slice(0, 2)
                                  .map((action, index) => {
                                    const isLoading = isActionLoading(
                                      order.id,
                                      action.action
                                    );

                                    return (
                                      <Button
                                        key={index}
                                        variant={action.variant}
                                        size="sm"
                                        onClick={() =>
                                          handleOrderAction(
                                            action.action,
                                            order.id
                                          )
                                        }
                                        disabled={
                                          isLoading ||
                                          loadingAction !== null ||
                                          orderActionMutation.isPending
                                        }
                                        className="text-xs px-2 py-1 cursor-pointer"
                                      >
                                        {isLoading ? (
                                          <>
                                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                            {action.label}...
                                          </>
                                        ) : (
                                          action.label
                                        )}
                                      </Button>
                                    );
                                  })}
                                {order.nextActions.length > 2 && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleOrderAction(
                                        "VIEW_DETAILS",
                                        order.id
                                      )
                                    }
                                    className="text-xs px-2 py-1 cursor-pointer"
                                  >
                                    +{order.nextActions.length - 2}
                                  </Button>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <Link
                                href={`/dashboard/orders/${order.id}`}
                                className="cursor-pointer text-xs dark:text-gray-200 
           dark:hover:text-gray-100 transition flex items-center gap-2"
                              >
                                View
                                <SquareArrowOutUpRight size={12} />
                              </Link>
                            </td>
                          </tr>
                        </React.Fragment>
                      ))}
                    </tbody>
                  )}
                </table>

                {orders.length === 0 && (
                  <div className="text-center py-12">
                    <Package className="w-16 h-16 text-gray-400 dark:text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-400 mb-2">
                      No orders found
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Try adjusting your filters or search terms.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mobile & Tablet: Card View */}
        <div className="lg:hidden space-y-3">
          {isFiltering ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 text-blue-600 mx-auto mb-2 animate-spin" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Loading...
              </p>
            </div>
          ) : orders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="w-16 h-16 text-gray-400 dark:text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-400 mb-2">
                  No orders found
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Try adjusting your filters or search terms.
                </p>
              </CardContent>
            </Card>
          ) : (
            orders.map((order) => (
              <Card key={order.id} className="overflow-hidden">
                <CardContent className="p-4">
                  {/* Header Row */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3 flex-1">
                      <input
                        type="checkbox"
                        className="rounded mt-1"
                        checked={selectedOrders.has(order.id)}
                        onChange={() => toggleOrderSelection(order.id)}
                      />
                      <div className="flex-1">
                        <div className="font-semibold text-base">
                          {order.orderNumber}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <Badge
                      className={getStatusColor(order.status as OrderStatus)}
                    >
                      {order.status.replace("_", " ")}
                    </Badge>
                  </div>

                  {/* Customer Info */}
                  <div className="mb-3 pb-3 border-b border-gray-200 dark:border-zinc-700">
                    <div className="text-sm font-medium">
                      {order.customerName}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {order.customerEmail}
                    </div>
                  </div>

                  {/* Order Details Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-3 pb-3 border-b border-gray-200 dark:border-zinc-700">
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Quantity
                      </div>
                      <div className="text-sm font-medium">
                        {order.items.reduce(
                          (sum, item) => sum + item.quantity,
                          0
                        )}{" "}
                        items
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Value
                      </div>
                      <div className="text-sm font-medium">
                        ${order.totalAmount}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Location
                      </div>
                      <div className="text-sm font-medium">
                        {order.shippingLocation.city},{" "}
                        {order.shippingLocation.state}
                      </div>
                    </div>
                    {order.pickListInfo && (
                      <div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Pick List
                        </div>
                        <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                          {order.pickListInfo.batchNumber}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="space-y-2">
                    {order.nextActions.slice(0, 3).map((action, index) => {
                      const isLoading = isActionLoading(
                        order.id,
                        action.action
                      );

                      return (
                        <Button
                          key={index}
                          variant={action.variant}
                          size="sm"
                          onClick={() =>
                            handleOrderAction(action.action, order.id)
                          }
                          disabled={
                            isLoading ||
                            loadingAction !== null ||
                            orderActionMutation.isPending
                          }
                          className="w-full text-sm cursor-pointer"
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              {action.label}...
                            </>
                          ) : (
                            action.label
                          )}
                        </Button>
                      );
                    })}
                    <Link href={`/dashboard/orders/${order.id}`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-sm cursor-pointer"
                      >
                        View Details
                        <SquareArrowOutUpRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </div>

                  {/* Expandable Items */}
                  {expandedOrder === order.id && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-zinc-700">
                      <div className="text-sm font-medium mb-2">
                        Order Items:
                      </div>
                      <div className="space-y-2">
                        {order.items.map((item) => (
                          <div
                            key={item.id}
                            className="bg-gray-50 dark:bg-zinc-800 p-2 rounded text-sm"
                          >
                            <div className="font-medium">
                              {item.productName}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              SKU: {item.sku} • Qty: {item.quantity} • $
                              {item.totalPrice}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Toggle Expand */}
                  <button
                    onClick={() =>
                      setExpandedOrder(
                        expandedOrder === order.id ? null : order.id
                      )
                    }
                    className="w-full mt-3 pt-3 border-t border-gray-200 dark:border-zinc-700 flex items-center justify-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                  >
                    {expandedOrder === order.id ? (
                      <>
                        <ChevronUp className="w-4 h-4 mr-1" />
                        Hide Items
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 mr-1" />
                        Show Items ({order.items.length})
                      </>
                    )}
                  </button>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between py-3 mt-4 gap-3">
            <div className="text-sm text-gray-600 dark:text-gray-400 text-center sm:text-left">
              Page {currentPage} of {totalPages} ({totalCount} orders)
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1 || isFiltering}
              >
                Previous
              </Button>

              {/* Page numbers - hide on very small screens */}
              <div className="hidden sm:flex gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum =
                    currentPage <= 3
                      ? i + 1
                      : currentPage >= totalPages - 2
                      ? totalPages - 4 + i
                      : currentPage - 2 + i;

                  if (pageNum < 1 || pageNum > totalPages) return null;

                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className="w-10"
                      disabled={isFiltering}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={currentPage === totalPages || isFiltering}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {insufficientModal && (
        <InsufficientInventoryModal
          items={insufficientModal.items}
          orderNumber={insufficientModal.orderNumber}
          orderId={insufficientModal.orderId}
          onClose={() => setInsufficientModal(null)}
          onAction={handleInsufficientAction}
        />
      )}
    </div>
  );
}
