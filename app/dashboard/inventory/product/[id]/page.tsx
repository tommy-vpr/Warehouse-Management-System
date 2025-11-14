"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  MapPin,
  Weight,
  Activity,
  Waves,
  AlertTriangle,
  Edit,
  Save,
  X,
  RefreshCw,
  ShoppingCart,
  ArrowRightLeft,
  Check,
  Loader2,
  Search,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ProductAnalyticsCard } from "@/components/product/ProductAnalyticsCard";
import { RecentTransactionsCard } from "@/components/product/RecentTransactionsCard ";

interface ProductDetails {
  id: string;
  productId: string;
  sku: string;
  upc?: string;
  name: string;
  description?: string;
  costPrice?: number;
  sellingPrice?: number;
  weight?: number;
  volume?: string;
  strength?: string;
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: string;
  };
  category?: string;
  supplier?: string;
  shopifyVariantId?: string;
  totalQuantity: number;
  totalReserved: number;
  totalAvailable: number;
  reorderPoint?: number;
  maxQuantity?: number;
  reorderStatus: "OK" | "LOW" | "CRITICAL" | "OVERSTOCK";
  locations: {
    id: string;
    inventoryId: string;
    name: string;
    type: string;
    warehouse?: number;
    bay?: string;
    space?: string;
    aisle?: string;
    tier?: string;
    bin?: string;
    quantity: number;
    isPickable: boolean;
    isReceivable: boolean;
    lastCounted?: string;
  }[];
  recentTransactions: {
    id: string;
    type: string;
    quantityChange: number;
    referenceId?: string;
    referenceType?: string;
    userId?: string;
    userName?: string;
    notes?: string;
    createdAt: string;
  }[];
  analytics: {
    monthlyMovement: number;
    averageVelocity: number;
    turnoverRate: number;
    daysSinceLastSale: number;
    totalValue: number;
    profitMargin?: number;
  };
}

type SimpleLocation = {
  id: string;
  name: string;
  type: string;
  zone?: string | null;
  isPickable?: boolean;
  isReceivable?: boolean;
};

export default function ProductDetailPage(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const productVariantId = params.id;

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<ProductDetails>>({});
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [isCreatingReorder, setIsCreatingReorder] = useState(false);

  const [transactionType, setTransactionType] = useState<
    "ADJUSTMENT" | "TRANSFER"
  >("ADJUSTMENT");
  const [transactionData, setTransactionData] = useState({
    quantity: "",
    locationId: "",
    toLocationId: "",
    notes: "",
    reason: "",
    confirmerId: "",
  });

  // New state for destination location search
  const [showDestinationSearch, setShowDestinationSearch] = useState(false);
  const [destinationSearchQuery, setDestinationSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [selectedNewLocation, setSelectedNewLocation] =
    useState<SimpleLocation | null>(null);

  // Debounce search query
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(destinationSearchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [destinationSearchQuery]);

  // Query to fetch users
  const { data: confirmUsers } = useQuery({
    queryKey: ["assignable-users"],
    queryFn: async () => {
      const response = await fetch("/api/users/assignable");
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
  });

  // Fetch product details
  const {
    data: product,
    isLoading,
    isError,
  } = useQuery<ProductDetails>({
    queryKey: ["product", productVariantId],
    queryFn: async () => {
      const response = await fetch(
        `/api/inventory/product/${productVariantId}`
      );
      if (!response.ok) {
        throw new Error("Product not found");
      }
      return response.json();
    },
    enabled: !!productVariantId && typeof window !== "undefined",
    staleTime: 30000,
    retry: 1,
  });

  // Fetch all locations once when searching starts
  const { data: allLocations, isLoading: isSearchingLocations } = useQuery<
    SimpleLocation[]
  >({
    queryKey: ["locations"],
    queryFn: async () => {
      const response = await fetch("/api/locations");
      if (!response.ok) throw new Error("Failed to fetch locations");
      return response.json();
    },
    enabled: debouncedSearchQuery.length >= 2,
    staleTime: 5 * 60 * 1000,
  });

  // Filter locations on client side based on search query
  const searchedLocations = React.useMemo(() => {
    if (!allLocations || debouncedSearchQuery.length < 2) return [];

    const query = debouncedSearchQuery.toLowerCase();
    return allLocations.filter(
      (loc) =>
        loc.name.toLowerCase().includes(query) ||
        loc.type.toLowerCase().includes(query)
    );
  }, [allLocations, debouncedSearchQuery]);

  // Update product mutation
  const updateMutation = useMutation({
    mutationFn: async (updatedData: Partial<ProductDetails>) => {
      const response = await fetch(
        `/api/inventory/product/${productVariantId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedData),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update product");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["product", productVariantId],
      });
      setIsEditing(false);
    },
    onError: (error: Error) => {
      alert(`Error updating product: ${error.message}`);
    },
  });

  // Transaction mutation
  const transactionMutation = useMutation({
    mutationFn: async (data: {
      productVariantId: string;
      transactionType: string;
      quantityChange: number;
      locationId: string | null;
      toLocationId: string | null;
      notes: string;
      referenceType: string;
    }) => {
      const response = await fetch(`/api/inventory/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create transaction");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["product", productVariantId],
      });
      setShowTransactionModal(false);
      setTransactionData({
        quantity: "",
        locationId: "",
        toLocationId: "",
        notes: "",
        reason: "",
        confirmerId: "",
      });
      setShowDestinationSearch(false);
      setDestinationSearchQuery("");
    },
    onError: (error: Error) => {
      alert(`Error creating transaction: ${error.message}`);
    },
  });

  // Initialize edit form when product data loads
  React.useEffect(() => {
    if (product && !isEditing) {
      setEditForm(product);
    }
  }, [product, isEditing]);

  const handleSaveEdit = () => {
    updateMutation.mutate(editForm);
  };

  const handleTransaction = () => {
    const data =
      transactionType === "TRANSFER"
        ? {
            productVariantId,
            transactionType: "TRANSFER",
            quantityChange: parseInt(transactionData.quantity),
            locationId: transactionData.locationId,
            toLocationId: transactionData.toLocationId,
            notes: transactionData.notes,
            referenceType: "MANUAL",
            confirmerId: transactionData.confirmerId,
          }
        : {
            productVariantId,
            transactionType,
            quantityChange: parseInt(transactionData.quantity),
            locationId: transactionData.locationId || null,
            toLocationId: null,
            notes: transactionData.notes,
            referenceType: "MANUAL",
          };

    console.log("Transaction data:", data);
    transactionMutation.mutate(data);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "OK":
        return "bg-green-100 text-green-800 dark:bg-green-600 dark:text-green-100";
      case "LOW":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-600 dark:text-yellow-100";
      case "CRITICAL":
        return "bg-red-100 text-red-800 dark:bg-red-600 dark:text-red-100";
      case "OVERSTOCK":
        return "bg-blue-100 text-blue-800 dark:bg-blue-600 dark:text-blue-100";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-100";
    }
  };

  if (isLoading || !product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600 dark:text-gray-200">
            Loading product details...
          </p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-gray-600">Product not found</p>
          <Button
            onClick={() => router.push("/dashboard/inventory")}
            className="mt-4"
          >
            Back to Inventory
          </Button>
        </div>
      </div>
    );
  }

  const hasRecentReorderRequest = product.recentTransactions.some(
    (transaction) => transaction.referenceType === "REORDER_REQUEST"
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-center mb-6">
          <div className="flex items-center w-full">
            <Button
              variant="ghost"
              onClick={() => router.push("/dashboard/inventory")}
              className="mr-4 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {product.name}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                SKU: {product.sku}
              </p>
            </div>
          </div>
          <div className="flex gap-3 ml-auto mt-8 sm:mt-0">
            <Button
              variant="outline"
              onClick={() => {
                setTransactionType("ADJUSTMENT");
                setShowTransactionModal(true);
              }}
              disabled={transactionMutation.isPending}
              className="cursor-pointer"
            >
              <Edit className="w-4 h-4" />
              Adjust Stock
            </Button>
            <Button
              className="cursor-pointer"
              variant={isEditing ? "outline" : "default"}
              onClick={() => {
                if (isEditing) {
                  setIsEditing(false);
                  setEditForm(product);
                } else {
                  setIsEditing(true);
                }
              }}
            >
              {isEditing ? (
                <>
                  <X className="w-4 h-4" />
                  Cancel
                </>
              ) : (
                <>
                  <Edit className="w-4 h-4" />
                  Edit
                </>
              )}
            </Button>
            {isEditing && (
              <Button
                className="cursor-pointer"
                onClick={handleSaveEdit}
                disabled={updateMutation.isPending}
              >
                <Save className="w-4 h-4" />
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Product Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Product Details Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Product Information</span>
                  <Badge className={getStatusColor(product.reorderStatus)}>
                    {product.reorderStatus}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-500 mb-1">
                      Product Name
                    </label>
                    {isEditing ? (
                      <Input
                        value={editForm.name || ""}
                        onChange={(e) =>
                          setEditForm({ ...editForm, name: e.target.value })
                        }
                      />
                    ) : (
                      <p className="text-gray-900 dark:text-gray-200">
                        {product.name}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-500 mb-1">
                      SKU
                    </label>
                    <p className="text-gray-900 dark:text-gray-200 font-mono">
                      {product.sku}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-500 mb-1">
                      UPC
                    </label>
                    {isEditing ? (
                      <Input
                        value={editForm.upc || ""}
                        onChange={(e) =>
                          setEditForm({ ...editForm, upc: e.target.value })
                        }
                      />
                    ) : (
                      <p className="text-gray-900 dark:text-gray-200 font-mono">
                        {product.upc || "Not set"}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-500 mb-1">
                      Category
                    </label>
                    {isEditing ? (
                      <Input
                        value={editForm.category || ""}
                        onChange={(e) =>
                          setEditForm({ ...editForm, category: e.target.value })
                        }
                      />
                    ) : (
                      <p className="text-gray-900 dark:text-gray-200">
                        {product.category || "Uncategorized"}
                      </p>
                    )}
                  </div>
                </div>

                {product.description && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-500 mb-1">
                      Description
                    </label>
                    {isEditing ? (
                      <textarea
                        value={editForm.description || ""}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            description: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        rows={3}
                      />
                    ) : (
                      <p className="text-gray-600 dark:text-gray-200 ">
                        {product.description}
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-500 mb-1">
                      <Weight className="w-4 h-4 inline mr-1" />
                      Weight (oz)
                    </label>
                    {isEditing ? (
                      <Input
                        type="number"
                        step="0.1"
                        value={
                          editForm.weight
                            ? (editForm.weight / 28.35).toFixed(2)
                            : ""
                        }
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            weight: parseFloat(e.target.value) * 28.35,
                          })
                        }
                      />
                    ) : (
                      <p className="text-gray-900 dark:text-gray-200">
                        {product.weight
                          ? `${(product.weight / 28.35).toFixed(2)} oz`
                          : "Not set"}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-500 mb-1">
                      <Waves className="w-4 h-4 inline mr-1" />
                      Volume
                    </label>
                    {isEditing ? (
                      <Input
                        value={editForm.volume || ""}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            volume: e.target.value,
                          })
                        }
                        placeholder="e.g., 100ml"
                      />
                    ) : (
                      <p className="text-gray-900 dark:text-gray-200">
                        {product.volume || "Not set"}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-500 mb-1">
                      <Activity className="w-4 h-4 inline mr-1" />
                      Strength
                    </label>
                    {isEditing ? (
                      <Input
                        value={editForm.strength || ""}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            strength: e.target.value,
                          })
                        }
                        placeholder="e.g., 03mg"
                      />
                    ) : (
                      <p className="text-gray-900 dark:text-gray-200">
                        {product.strength || "Not set"}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stock Levels Card */}
            <Card>
              <CardHeader>
                <CardTitle>Stock Levels & Reorder Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {product.totalQuantity}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      On Hand
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {product.totalReserved}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Reserved
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {product.totalAvailable}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Available
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      ${product.analytics.totalValue.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Total Value
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">
                      Reorder Point
                    </label>
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editForm.reorderPoint || ""}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            reorderPoint: parseInt(e.target.value),
                          })
                        }
                      />
                    ) : (
                      <p className="text-gray-900 dark:text-gray-400">
                        {product.reorderPoint || "Not set"}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">
                      Max Quantity
                    </label>
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editForm.maxQuantity || ""}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            maxQuantity: parseInt(e.target.value),
                          })
                        }
                      />
                    ) : (
                      <p className="text-gray-900 dark:text-gray-400">
                        {product.maxQuantity || "Not set"}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Locations Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MapPin className="w-5 h-5 mr-2" />
                  Storage Locations ({product.locations.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {product.locations.map((location) => (
                    <div
                      key={location.id}
                      className="flex items-center justify-between p-3 bg-background rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{location.name}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {location.warehouse &&
                            `Warehouse ${location.warehouse}`}
                          {location.aisle && ` · Aisle ${location.aisle}`}
                          {location.bay && ` · Bay ${location.bay}`}
                          {location.tier && ` · Tier ${location.tier}`}
                          {location.space && ` · Space ${location.space}`}
                          {location.bin && ` · Bin ${location.bin}`}
                        </div>
                        <div className="flex gap-2 mt-1">
                          <Badge
                            variant={
                              location.isPickable ? "default" : "secondary"
                            }
                          >
                            {location.isPickable ? "Pickable" : "Non-pickable"}
                          </Badge>
                          <Badge
                            variant={
                              location.isReceivable ? "default" : "secondary"
                            }
                          >
                            {location.isReceivable
                              ? "Receivable"
                              : "Non-receivable"}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">
                          {location.quantity}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          units
                        </div>
                        {location.lastCounted && (
                          <div className="text-xs text-gray-500">
                            Counted:{" "}
                            {new Date(
                              location.lastCounted
                            ).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Analytics Card */}
            <ProductAnalyticsCard analytics={product.analytics} />

            {/* Quick Actions Card */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    setTransactionType("ADJUSTMENT");
                    setShowTransactionModal(true);
                  }}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Adjust Quantity
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start cursor-pointer"
                  onClick={() =>
                    router.push(
                      `/dashboard/inventory/count?product=${productVariantId}`
                    )
                  }
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Cycle Count
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start cursor-pointer"
                  onClick={() => {
                    setTransactionType("TRANSFER");
                    setShowTransactionModal(true);
                  }}
                >
                  <ArrowRightLeft className="w-4 h-4 mr-2" />
                  Transfer Stock
                </Button>
                {product.reorderStatus === "CRITICAL" &&
                  !hasRecentReorderRequest && (
                    <Button
                      variant="outline"
                      className="w-full justify-start cursor-pointer"
                      disabled={isCreatingReorder}
                      onClick={async () => {
                        try {
                          setIsCreatingReorder(true);
                          const response = await fetch(
                            "/api/inventory/actions",
                            {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                action: "REORDER",
                                itemId: product.locations[0]?.inventoryId,
                              }),
                            }
                          );

                          if (response.ok) {
                            queryClient.invalidateQueries({
                              queryKey: ["product", productVariantId],
                            });
                          } else {
                            const error = await response.json();
                            alert(
                              `Error: ${
                                error.error || "Failed to create reorder"
                              }`
                            );
                          }
                        } catch (error) {
                          console.error("Failed to create reorder:", error);
                          alert("Failed to create reorder request");
                        } finally {
                          setIsCreatingReorder(false);
                        }
                      }}
                    >
                      {isCreatingReorder ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          Create Reorder
                        </>
                      )}
                    </Button>
                  )}
                {product.reorderStatus === "CRITICAL" &&
                  hasRecentReorderRequest && (
                    <div className="p-2 bg-green-200 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                      <p className="text-sm text-green-800 dark:text-green-200 flex items-center gap-1">
                        <Check size={16} />{" "}
                        <span>Reorder already requested</span>
                      </p>
                    </div>
                  )}
              </CardContent>
            </Card>

            {/* Recent Transactions */}
            <Card className="max-h-[480px] overflow-y-auto">
              <RecentTransactionsCard
                transactions={product.recentTransactions}
                productVariantId={productVariantId}
              />
            </Card>
          </div>
        </div>

        {/* Transaction Modal */}
        {showTransactionModal && (
          <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
            <div className="bg-background rounded-lg border border-gray-200 dark:border-zinc-800 p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-medium mb-4">Stock Adjustment</h3>

              <div className="space-y-4">
                {/* Transaction Type Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Transaction Type
                  </label>
                  <select
                    value={transactionType}
                    onChange={(e) => setTransactionType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="ADJUSTMENT">Adjustment</option>
                    <option value="TRANSFER">Transfer</option>
                  </select>
                </div>

                {/* Conditional Location Inputs */}
                {transactionType === "TRANSFER" ? (
                  <>
                    {/* FROM LOCATION - Only locations with stock */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                        From Location
                      </label>
                      <select
                        value={transactionData.locationId}
                        onChange={(e) =>
                          setTransactionData({
                            ...transactionData,
                            locationId: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-gray-200"
                      >
                        <option value="">Select source location</option>
                        {product.locations.map((location) => (
                          <option key={location.id} value={location.id}>
                            {location.name} ({location.quantity} units)
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* TO LOCATION - Always show locations with SKU + search for new */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                        To Location
                      </label>

                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                        Select from existing locations or search to add new.
                      </p>

                      {/* Always visible dropdown showing locations with SKU */}
                      <div className="border border-gray-300 dark:border-gray-600 rounded-md mb-2 max-h-48 overflow-y-auto bg-white dark:bg-gray-800">
                        {product?.locations && product.locations.length > 0 ? (
                          product.locations.map((location) => (
                            <button
                              key={location.id}
                              type="button"
                              onClick={() => {
                                setTransactionData({
                                  ...transactionData,
                                  toLocationId: location.id,
                                });
                                setSelectedNewLocation(null); // Clear since it's from existing locations
                              }}
                              className={`w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-700 last:border-b-0 ${
                                transactionData.toLocationId === location.id
                                  ? "bg-blue-50 dark:bg-blue-900/20"
                                  : ""
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="font-medium text-gray-900 dark:text-gray-100">
                                  {location.name}
                                </div>
                                <Badge
                                  variant="default"
                                  className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                >
                                  {location.quantity} units
                                </Badge>
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {location.type}
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                            No locations with this SKU yet
                          </div>
                        )}
                      </div>

                      {/* Search to add new location */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                          Or Add New Location
                        </label>
                        <div className="relative mb-2">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            type="text"
                            placeholder="Search for new location..."
                            value={destinationSearchQuery}
                            onChange={(e) => {
                              setDestinationSearchQuery(e.target.value);
                              if (!showDestinationSearch) {
                                setShowDestinationSearch(true);
                              }
                            }}
                            onFocus={() => setShowDestinationSearch(true)}
                            className="pl-10"
                          />
                          {isSearchingLocations && (
                            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
                          )}
                        </div>

                        {/* Search Results Dropdown */}
                        {showDestinationSearch &&
                          debouncedSearchQuery.length >= 2 && (
                            <div className="border border-gray-300 dark:border-gray-600 rounded-md max-h-48 overflow-y-auto bg-white dark:bg-gray-800">
                              {isSearchingLocations ? (
                                <div className="px-3 py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                                  <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
                                  Searching...
                                </div>
                              ) : searchedLocations &&
                                searchedLocations.length > 0 ? (
                                searchedLocations
                                  .filter(
                                    (loc) =>
                                      !product?.locations.some(
                                        (pLoc) => pLoc.id === loc.id
                                      )
                                  )
                                  .map((location) => (
                                    <button
                                      key={location.id}
                                      type="button"
                                      onClick={() => {
                                        setTransactionData({
                                          ...transactionData,
                                          toLocationId: location.id,
                                        });
                                        setSelectedNewLocation(location);
                                        setDestinationSearchQuery("");
                                        setShowDestinationSearch(false);
                                      }}
                                      className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="font-medium text-gray-900 dark:text-gray-100">
                                          {location.name}
                                        </div>
                                        <Badge
                                          variant="outline"
                                          className="text-xs"
                                        >
                                          New Location
                                        </Badge>
                                      </div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400">
                                        {location.type}
                                      </div>
                                    </button>
                                  ))
                              ) : (
                                <div className="px-3 py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                                  No additional locations found
                                </div>
                              )}
                            </div>
                          )}
                      </div>

                      {/* Selected Location Display */}
                      {transactionData.toLocationId && (
                        <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md flex items-center justify-between">
                          <div className="flex-1">
                            <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                              Selected Location:
                            </span>
                            <div className="text-sm text-blue-900 dark:text-blue-200 font-medium">
                              {product?.locations.find(
                                (l) => l.id === transactionData.toLocationId
                              )?.name ||
                                selectedNewLocation?.name ||
                                "Unknown Location"}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setTransactionData({
                                ...transactionData,
                                toLocationId: "",
                              });
                              setSelectedNewLocation(null);
                            }}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Confirmer Dropdown */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                        Assign Confirmer <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={transactionData.confirmerId}
                        onChange={(e) =>
                          setTransactionData({
                            ...transactionData,
                            confirmerId: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-gray-200"
                        required
                      >
                        <option value="">Select a confirmer...</option>
                        {confirmUsers?.map((user: any) => (
                          <option key={user.id} value={user.id}>
                            {user.name} ({user.role})
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        This user must confirm the transfer before it's applied
                      </p>
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      Location
                    </label>
                    <select
                      value={transactionData.locationId}
                      onChange={(e) =>
                        setTransactionData({
                          ...transactionData,
                          locationId: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">
                        {transactionType === "ADJUSTMENT"
                          ? "All Locations"
                          : "Select location"}
                      </option>
                      {product.locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name} ({location.quantity} units)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Quantity Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Quantity{" "}
                    {transactionType === "TRANSFER" ? "to Transfer" : "Change"}
                  </label>
                  <Input
                    type="number"
                    value={transactionData.quantity}
                    onChange={(e) =>
                      setTransactionData({
                        ...transactionData,
                        quantity: e.target.value,
                      })
                    }
                    placeholder={
                      transactionType === "TRANSFER"
                        ? "Enter quantity"
                        : "Enter positive or negative number"
                    }
                  />
                  {transactionType === "ADJUSTMENT" && (
                    <p className="text-xs text-gray-500 mt-1">
                      Use negative numbers to reduce stock, positive to increase
                    </p>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={transactionData.notes}
                    onChange={(e) =>
                      setTransactionData({
                        ...transactionData,
                        notes: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-gray-200"
                    rows={3}
                    placeholder="Reason for adjustment..."
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowTransactionModal(false);
                    setShowDestinationSearch(false);
                    setDestinationSearchQuery("");
                    setSelectedNewLocation(null);
                  }}
                  className="flex-1 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleTransaction}
                  disabled={
                    transactionMutation.isPending ||
                    !transactionData.quantity ||
                    (transactionType === "TRANSFER" &&
                      (!transactionData.locationId ||
                        !transactionData.toLocationId ||
                        !transactionData.confirmerId))
                  }
                  className="flex-1 cursor-pointer"
                >
                  {transactionMutation.isPending
                    ? "Processing..."
                    : transactionType === "TRANSFER"
                    ? "Request Transfer"
                    : "Apply Change"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
