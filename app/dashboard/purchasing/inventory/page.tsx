"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  Search,
  RefreshCw,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Eye,
  BarChart3,
  Box,
  ShoppingCart,
  Plus,
  Edit,
  History,
  Repeat2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { InventorySkeleton } from "@/components/skeleton/Inventory";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { keepPreviousData } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/useDebounce";

import { useSearchParams } from "next/navigation";

interface InventoryItem {
  inventoryId: string;
  productVariantId: string;
  productName: string;
  sku: string;
  upc?: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  reorderPoint?: number;
  maxQuantity?: number;
  costPrice?: string;
  sellingPrice?: string;
  weight?: number;
  locations: {
    locationId: string;
    locationName: string;
    quantity: number;
    zone?: string;
    aisle?: string;
    shelf?: string;
  }[];
  lastCounted?: string;
  reorderStatus: "OK" | "LOW" | "CRITICAL" | "OVERSTOCK";
  category?: string;
  supplier?: string;
  updatedAt: string;
}

interface InventoryStats {
  totalProducts: number;
  totalValue: number;
  lowStock: number;
  outOfStock: number;
  overstock: number;
  recentTransactions: number;
}

interface InventoryResponse {
  inventory: InventoryItem[];
  stats: InventoryStats;
  totalPages: number;
  currentPage: number;
  totalCount: number;
}

export default function InventoryDashboard(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [mounted, setMounted] = useState(false); // ✅ hydration guard
  useEffect(() => setMounted(true), []);

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const [locationFilter, setLocationFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm]);

  // Fetch inventory data with TanStack Query
  const { data, isLoading, isFetching, isError, error } =
    useQuery<InventoryResponse>({
      queryKey: [
        "inventory",
        debouncedSearchTerm,
        locationFilter,
        statusFilter,
        categoryFilter,
        currentPage,
      ],
      queryFn: async () => {
        const params = new URLSearchParams();
        if (debouncedSearchTerm) params.set("search", debouncedSearchTerm);
        if (locationFilter !== "ALL") params.set("location", locationFilter);
        if (statusFilter !== "ALL") params.set("status", statusFilter);
        if (categoryFilter !== "ALL") params.set("category", categoryFilter);
        params.set("page", currentPage.toString());
        params.set("limit", itemsPerPage.toString());

        const response = await fetch(`/api/inventory?${params}`);
        if (!response.ok) throw new Error("Failed to fetch inventory");
        return response.json();
      },
      staleTime: 30000,
      refetchOnWindowFocus: false,
      placeholderData: keepPreviousData,
    });

  const isFiltering = isFetching && data !== undefined;
  const inventory = data?.inventory || [];
  const stats = data?.stats;
  const totalPages = data?.totalPages || 1;

  // Mutation for inventory actions
  const actionMutation = useMutation({
    mutationFn: async ({
      action,
      itemId,
      quantity,
    }: {
      action: string;
      itemId: string;
      quantity?: number;
    }) => {
      const response = await fetch("/api/inventory/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, itemId, quantity }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to perform action");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (error: Error) => {
      alert(`Error: ${error.message}`);
    },
  });

  const handleQuickAction = async (
    action: string,
    itemId: string,
    quantity?: number
  ) => {
    actionMutation.mutate({ action, itemId, quantity });
  };

  const navigateToProduct = (productVariantId: string) => {
    router.push(`/dashboard/inventory/product/${productVariantId}`);
  };

  const getStockStatusColor = (status: string) => {
    switch (status) {
      case "OK":
        return "bg-green-100 dark:bg-green-500 text-green-800 dark:text-green-900";
      case "LOW":
        return "bg-yellow-100 dark:bg-yellow-500 text-yellow-800 dark:text-yellow-900";
      case "CRITICAL":
        return "bg-red-100 dark:bg-red-400 text-red-800 dark:text-red-900";
      case "OVERSTOCK":
        return "bg-blue-100 dark:bg-blue-500 text-blue-800 dark:text-blue-900";
      default:
        return "bg-gray-100 dark:bg-gray-500 text-gray-800 dark:text-gray-900";
    }
  };

  const getStockIcon = (status: string) => {
    switch (status) {
      case "LOW":
        return <TrendingDown className="w-4 h-4" />;
      case "CRITICAL":
        return <AlertTriangle className="w-4 h-4" />;
      case "OVERSTOCK":
        return <TrendingUp className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  const handleFilterChange =
    (setter: (value: string) => void) => (value: string) => {
      setter(value);
      setCurrentPage(1);
    };

  if (isError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-gray-600">
            Error loading inventory: {error?.message}
          </p>
          <Button
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ["inventory"] })
            }
            className="mt-4"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const searchParams = useSearchParams();

  useEffect(() => {
    const urlStatus = searchParams.get("status") || "ALL";
    const urlLocation = searchParams.get("location") || "ALL";
    const urlCategory = searchParams.get("category") || "ALL";

    setStatusFilter(urlStatus);
    setLocationFilter(urlLocation);
    setCategoryFilter(urlCategory);
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Inventory Management
              </h1>
              <p className="text-gray-600 dark:text-gray-500">
                Track stock levels, locations, and product details
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() =>
                  queryClient.invalidateQueries({ queryKey: ["inventory"] })
                }
                disabled={mounted ? isLoading : false}
                // disabled={isFetching}
              >
                <RefreshCw
                  className={`w-4 h-4 ${
                    mounted && (isLoading || isFetching) ? "animate-spin" : ""
                  }`}
                />
                Refresh
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/dashboard/inventory/receive")}
              >
                <Plus className="w-4 h-4" />
                Receive Stock
              </Button>

              <Button
                variant="outline"
                onClick={() => router.push("/dashboard/inventory/count")}
              >
                <Repeat2 className="w-4 h-4" />
                Cycle Count
              </Button>
              {/* <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/dashboard/inventory/count")}
              >
                <Repeat2 className="w-4 h-4" />
                Cycle Count
              </Button> */}
            </div>
          </div>

          {/* Statistics Cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              {/* totalProducts */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center">
                    <Package className="w-6 h-6 text-blue-500" />
                    <div className="ml-3">
                      <p className="text-lg font-bold">{stats.totalProducts}</p>
                      <p className="text-xs text-gray-600">Products</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {/* totalValue */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center">
                    <BarChart3 className="w-6 h-6 text-green-600" />
                    <div className="ml-3">
                      <p className="text-lg font-bold">
                        $
                        {mounted
                          ? stats.totalValue.toLocaleString()
                          : stats.totalValue}
                      </p>
                      <p className="text-xs text-gray-600">Total Value</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {/* lowStock */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center">
                    <TrendingDown className="w-6 h-6 text-yellow-600" />
                    <div className="ml-3">
                      <p className="text-lg font-bold">{stats.lowStock}</p>
                      <p className="text-xs text-gray-600">Low Stock</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {/* outOfStock */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center">
                    <AlertTriangle className="w-6 h-6 text-red-400" />
                    <div className="ml-3">
                      <p className="text-lg font-bold">{stats.outOfStock}</p>
                      <p className="text-xs text-gray-600">Out of Stock</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {/* overstock */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center">
                    <TrendingUp className="w-6 h-6 text-blue-500" />
                    <div className="ml-3">
                      <p className="text-lg font-bold">{stats.overstock}</p>
                      <p className="text-xs text-gray-600">Overstock</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {/* recentTransactions */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center">
                    <History className="w-6 h-6 text-purple-600" />
                    <div className="ml-3">
                      <p className="text-lg font-bold">
                        {stats.recentTransactions}
                      </p>
                      <p className="text-xs text-gray-600">Recent Moves</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6 text-sm">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by SKU, product name, or UPC..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 dark:border-zinc-700"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) =>
                handleFilterChange(setStatusFilter)(e.target.value)
              }
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:text-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Status</option>
              <option value="OK">In Stock</option>
              <option value="LOW">Low Stock</option>
              <option value="CRITICAL">Critical</option>
              <option value="OVERSTOCK">Overstock</option>
            </select>
            <select
              value={locationFilter}
              onChange={(e) =>
                handleFilterChange(setLocationFilter)(e.target.value)
              }
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:text-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Locations</option>
              <option value="A">Zone A</option>
              <option value="B">Zone B</option>
              <option value="C">Zone C</option>
              <option value="RECEIVING">Receiving</option>
              <option value="SHIPPING">Shipping</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) =>
                handleFilterChange(setCategoryFilter)(e.target.value)
              }
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:text-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Categories</option>
              <option value="ELECTRONICS">Electronics</option>
              <option value="CLOTHING">Clothing</option>
              <option value="BOOKS">Books</option>
              <option value="HOME">Home & Garden</option>
            </select>
          </div>
        </div>

        {/* Inventory Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">Inventory</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-background border-b dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stock Level
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location(s)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Value
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Count
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                {isFiltering ? (
                  <InventorySkeleton />
                ) : (
                  <tbody className="bg-background divide-y divide-gray-200 dark:divide-zinc-700">
                    {inventory.map((item) => (
                      <React.Fragment key={item.inventoryId}>
                        <tr className="hover:bg-background cursor-pointer">
                          <td
                            className="px-4 py-4"
                            onClick={() =>
                              navigateToProduct(item.productVariantId)
                            }
                          >
                            <div>
                              <div className="font-medium text-blue-500 hover:text-blue-800 dark:text-gray-200 dark:hover:text-gray-300 transition">
                                {item.productName}
                              </div>
                              <div className="text-sm text-gray-500">
                                SKU: {item.sku}
                              </div>
                              {item.upc && (
                                <div className="text-xs text-gray-400">
                                  UPC: {item.upc}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div>
                              <div className="font-medium">
                                {item.quantityOnHand} on hand
                              </div>
                              <div className="text-sm text-gray-500">
                                {item.quantityReserved} reserved
                              </div>
                              <div className="text-sm font-medium text-green-600">
                                {item.quantityAvailable} available
                              </div>
                              {item.reorderPoint && (
                                <div className="text-xs text-gray-400">
                                  Reorder at: {item.reorderPoint}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <Badge
                              className={getStockStatusColor(
                                item.reorderStatus
                              )}
                            >
                              <span className="flex items-center">
                                {getStockIcon(item.reorderStatus)}
                                <span className="ml-1">
                                  {item.reorderStatus}
                                </span>
                              </span>
                            </Badge>
                          </td>
                          <td className="px-4 py-4">
                            <div className="space-y-1">
                              {item.locations.slice(0, 2).map((location) => (
                                <div
                                  key={location.locationId}
                                  className="text-sm"
                                >
                                  <span className="font-medium">
                                    {location.locationName}
                                  </span>
                                  <span className="text-gray-500 ml-2">
                                    ({location.quantity})
                                  </span>
                                </div>
                              ))}
                              {item.locations.length > 2 && (
                                <div
                                  className="text-xs text-blue-500 cursor-pointer"
                                  onClick={() =>
                                    setExpandedItem(
                                      expandedItem === item.inventoryId
                                        ? null
                                        : item.inventoryId
                                    )
                                  }
                                >
                                  +{item.locations.length - 2} more locations
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div>
                              {item.costPrice ? (
                                <div className="text-sm">
                                  Cost: ${item.costPrice}
                                </div>
                              ) : (
                                "---"
                              )}
                              {item.sellingPrice && (
                                <div className="text-sm font-medium">
                                  Sell: ${item.sellingPrice}
                                </div>
                              )}
                              {item.costPrice && (
                                <div className="text-xs text-gray-500">
                                  Total: $
                                  {(
                                    parseFloat(item.costPrice) *
                                    item.quantityOnHand
                                  ).toFixed(2)}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm">
                              {mounted && item.lastCounted ? (
                                <>
                                  <div>
                                    {new Date(
                                      item.lastCounted
                                    ).toLocaleDateString()}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {new Date(
                                      item.lastCounted
                                    ).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </div>
                                </>
                              ) : (
                                "Never"
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  navigateToProduct(item.productVariantId)
                                }
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const qty = prompt("Adjust quantity by:");
                                  if (qty)
                                    handleQuickAction(
                                      "ADJUST",
                                      item.inventoryId,
                                      parseInt(qty)
                                    );
                                }}
                                disabled={actionMutation.isPending}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              {item.reorderStatus === "CRITICAL" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    handleQuickAction(
                                      "REORDER",
                                      item.inventoryId
                                    )
                                  }
                                  disabled={actionMutation.isPending}
                                >
                                  <ShoppingCart className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Location Details */}
                        {expandedItem === item.inventoryId && (
                          <tr>
                            <td colSpan={7} className="px-4 py-4 bg-background">
                              <div className="space-y-2">
                                <h4 className="font-medium">All Locations:</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {item.locations.map((location) => (
                                    <div
                                      key={location.locationId}
                                      className="bg-white p-3 rounded border"
                                    >
                                      <div className="font-medium">
                                        {location.locationName}
                                      </div>
                                      <div className="text-sm text-gray-600">
                                        Quantity: {location.quantity}
                                      </div>
                                      {location.zone && (
                                        <div className="text-xs text-gray-500">
                                          {location.zone}
                                          {location.aisle &&
                                            ` - ${location.aisle}`}
                                          {location.shelf &&
                                            ` - ${location.shelf}`}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                )}
              </table>

              {inventory.length === 0 && !isFiltering && (
                <div className="text-center py-12">
                  <Box className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No inventory found
                  </h3>
                  <p className="text-gray-600">
                    Try adjusting your filters or search terms.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between py-3 mt-4">
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              Showing page {currentPage} of {totalPages}
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
              <div className="flex gap-1">
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
    </div>
  );
}
