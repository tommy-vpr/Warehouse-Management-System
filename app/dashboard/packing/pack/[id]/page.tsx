"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  ArrowLeft,
  CheckCircle,
  User,
  MapPin,
  AlertTriangle,
  Truck,
  Box,
  Check,
  Loader2,
  Dot,
  TriangleAlert,
  Printer,
} from "lucide-react";
import { useParams } from "next/navigation";
import ShippingLabelForm from "@/components/shipping/ShippingLabelForm";
import OrderImageUploader from "@/components/order/OrderImageUploader";
import { useQueryClient } from "@tanstack/react-query";

interface OrderItem {
  id: string;
  productName: string;
  sku: string;
  quantity: number; // quantityToPack (reduced amount)
  originalQuantity?: number; // ✅ ADD: original order quantity
  quantityBackOrdered?: number; // ✅ ADD: back ordered amount
  unitPrice: string;
  totalPrice: string;
  weightGrams: number;
  weightOz: number;
  productVariantId: string;
}

interface PackingInfo {
  totalWeightGrams: number;
  totalWeightOz: number;
  totalWeightLbs: number;
  totalVolume: number;
  suggestedBox: string;
  estimatedShippingCost: number;
}

interface OrderDetails {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  status: string;
  totalAmount: string;
  shippingAddress: any;
  items: OrderItem[];
  images?: Array<{
    // ✅ ADD THIS
    id: string;
    url: string;
    createdAt: string;
  }>;
}

interface ApiResponse {
  success: boolean;
  order: OrderDetails;
  packingInfo: PackingInfo;
}

// Box Types Configuration
const BOX_TYPES = [
  {
    id: "SMALL",
    name: "Small Box",
    dimensions: "10x8x4",
    maxWeight: 5,
    cost: 0.5,
  },
  {
    id: "MEDIUM",
    name: "Medium Box",
    dimensions: "12x10x6",
    maxWeight: 15,
    cost: 1.0,
  },
  {
    id: "LARGE",
    name: "Large Box",
    dimensions: "18x14x8",
    maxWeight: 30,
    cost: 2.0,
  },
  {
    id: "CUSTOM",
    name: "Custom Box",
    dimensions: "Custom",
    maxWeight: 999,
    cost: 0,
  },
];

export default function EnhancedPackingInterface() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [packages, setPackages] = useState<any[]>([]);

  const queryClient = useQueryClient();

  // Order state
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [packingInfo, setPackingInfo] = useState<PackingInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ✅ ADD THIS: Packing task state
  const [packingTask, setPackingTask] = useState<any>(null);

  // Packing state
  const [selectedBox, setSelectedBox] = useState("");
  const [customDimensions, setCustomDimensions] = useState({
    length: "",
    width: "",
    height: "",
  });

  // Packing materials state
  const [packingMaterials, setPackingMaterials] = useState({
    bubbleWrap: false,
    voidFill: false,
    fragileSticker: false,
    extraTape: false,
  });

  // Item verification state
  const [verifiedItems, setVerifiedItems] = useState<Set<string>>(new Set());

  // Process state
  const [currentStep, setCurrentStep] = useState(1);
  const [isPacking, setIsPacking] = useState(false);

  const isPackingComplete = order?.status === "SHIPPED";

  const [verifyingItemId, setVerifyingItemId] = useState<string | null>(null);

  useEffect(() => {
    loadOrderDetails();
  }, []);

  const loadOrderDetails = async () => {
    try {
      const response = await fetch(`/api/packing/pack/${id}`);
      const data: any = await response.json();

      if (response.ok) {
        setOrder(data.order);

        // Set packages if order is already SHIPPED
        if (data.order?.shippingPackages) {
          setPackages(data.order.shippingPackages);
        }

        setPackingInfo(data.packingInfo);

        // Pre-select suggested box
        if (data.packingInfo.suggestedBox) {
          setSelectedBox(data.packingInfo.suggestedBox);
        }

        // ✅ ADD THIS: Try to find associated packing task
        try {
          const taskResponse = await fetch(`/api/packing-tasks/by-order/${id}`);

          if (taskResponse.ok) {
            const taskData = await taskResponse.json();
            setPackingTask(taskData.task);
            console.log("✅ Found packing task:", taskData.task.taskNumber);
          }
        } catch (err) {
          console.log(
            "No packing task found (that's ok, will work without it)"
          );
          // It's fine if there's no task - packing still works locally
        }
      } else {
        // ✅ Handle specific error cases with detailed information
        console.error("Failed to load order:", data);

        // Show detailed error if available
        if (
          data.details?.pendingItems &&
          data.details.pendingItems.length > 0
        ) {
          const pendingInfo = data.details.pendingItems
            .map(
              (item: any) =>
                `  • ${item.sku}: ${item.quantityPicked}/${item.quantityOrdered} picked`
            )
            .join("\n");

          alert(
            `${data.error}\n\nPending items:\n${pendingInfo}\n\nPlease complete picking these items first.`
          );
        } else {
          alert(data.error || "Order not found or not ready for packing");
        }
      }
    } catch (error) {
      console.error("Failed to load order:", error);
      alert("Failed to load order. Please try again.");
    }
    setIsLoading(false);
  };

  // Calculate total weight in pounds from packing info
  const calculatedWeightLbs = packingInfo?.totalWeightLbs || 0;
  const calculatedWeightOz = packingInfo?.totalWeightOz || 0;

  const toggleItemVerification = async (itemId: string) => {
    // ✅ Prevent multiple clicks
    if (verifyingItemId) return;

    // Unverify - just local
    if (verifiedItems.has(itemId)) {
      const newVerified = new Set(verifiedItems);
      newVerified.delete(itemId);
      setVerifiedItems(newVerified);
      return;
    }

    // ✅ Set loading state
    setVerifyingItemId(itemId);

    if (packingTask && order) {
      try {
        const orderItem = order.items.find((i) => i.id === itemId);

        if (!orderItem) {
          console.error("Order item not found");
          setVerifyingItemId(null);
          return;
        }

        // ✅ NEW: Pass orderId + productVariantId instead of taskItemId
        const response = await fetch(
          `/api/work-tasks/${packingTask.id}/complete-item`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: order.id,
              productVariantId: orderItem.productVariantId,
              quantityCompleted: orderItem.quantity || 1,
            }),
          }
        );

        if (response.ok) {
          const result = await response.json();

          // ✅ Update local state
          const newVerified = new Set(verifiedItems);
          newVerified.add(itemId);
          setVerifiedItems(newVerified);

          // ✅ Invalidate caches
          queryClient.invalidateQueries({ queryKey: ["packingTasks"] });
          queryClient.invalidateQueries({ queryKey: ["my-work"] });

          // ✅ Update local task state
          if (packingTask) {
            setPackingTask({
              ...packingTask,
              totalItems: result.progress.totalItems,
              completedItems: result.progress.completedItems,
            });
          }

          console.log("✅ Progress:", result.progress);

          // ✅ Check if task auto-completed
          if (result.taskComplete) {
            alert("All items packed! Task automatically completed. 🎉");
            queryClient.invalidateQueries({ queryKey: ["packingTasks"] });
            queryClient.invalidateQueries({ queryKey: ["my-work"] });
            setCurrentStep(2);
          }
        } else {
          const error = await response.json();
          console.error("API Error:", error);

          // ✅ GRACEFUL FALLBACK: Still mark as verified locally
          console.log("⚠️ Falling back to local verification");
          const newVerified = new Set(verifiedItems);
          newVerified.add(itemId);
          setVerifiedItems(newVerified);
        }
      } catch (error) {
        console.error("Error calling API:", error);

        // ✅ GRACEFUL FALLBACK: Still mark as verified locally
        console.log("⚠️ Falling back to local verification");
        const newVerified = new Set(verifiedItems);
        newVerified.add(itemId);
        setVerifiedItems(newVerified);
      } finally {
        setVerifyingItemId(null);
      }
    } else {
      // ✅ No task - just local verification (works fine)
      console.log("ℹ️ No packing task - using local verification only");
      const newVerified = new Set(verifiedItems);
      newVerified.add(itemId);
      setVerifiedItems(newVerified);
      setVerifyingItemId(null);
    }
  };

  // Check if can proceed to next step
  const canProceedToStep = (step: number) => {
    switch (step) {
      case 2: // Pack items → Create Label
        return order ? verifiedItems.size === order.items.length : false;
      default:
        return true;
    }
  };

  // Mark order as packed and move to Step 3
  const proceedToCreateLabel = async () => {
    if (!order) return;

    setIsPacking(true);
    try {
      // Mark order as PACKED
      const response = await fetch(`/api/packing/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          boxType: selectedBox,
          weight: calculatedWeightLbs,
          materials: packingMaterials,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to mark as packed");
      }

      setCurrentStep(2);
    } catch (error) {
      console.error("Failed to complete packing:", error);
      alert(
        `Failed to complete packing: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
    setIsPacking(false);
  };

  const handleLabelSuccess = async (results: any[]) => {
    if (!order) return;

    try {
      // Generate packing slips
      await fetch(`/api/packing/generate-packing-slip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });

      // ✅ Fetch updated order to get new status
      const response = await fetch(`/api/orders/${order.id}`);
      const data = await response.json();
      setOrder(data); // ← This will update isPackingComplete automatically
      setPackages(data.shippingPackages || []);
    } catch (error) {
      console.error(error);
    }
  };

  // Packing steps
  const steps = [
    {
      number: 1,
      title: "Pack Items",
      icon: Package,
      completed: canProceedToStep(3),
    },
    {
      number: 2,
      title: "Create Label",
      icon: Truck,
      completed: isPackingComplete,
    },
  ];

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600 dark:text-gray-200">
            Loading order details...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (!order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-200">
            Order not found or not ready for packing
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // Success state
  if (isPackingComplete) {
    return (
      <div className="bg-background dark:bg-background flex items-center justify-center p-3 sm:p-4">
        <div className="text-center max-w-2xl w-full">
          {/* Success Icon - Responsive Size */}
          <CheckCircle className="w-12 h-12 sm:w-16 sm:h-16 text-green-500 mx-auto mb-3 sm:mb-4" />

          {/* Success Message - Responsive Typography */}
          <h2 className="text-xl sm:text-2xl font-bold text-green-500 dark:text-green-600 mb-2">
            Order Packed & Labeled!
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mb-4 sm:mb-6">
            <Badge variant="outline" className="text-sm">
              {order.orderNumber}
            </Badge>{" "}
            is ready for shipping
          </p>

          {packages.length > 0 ? (
            <Card className="mb-4 sm:mb-6">
              <CardHeader className="pb-3 sm:pb-4">
                <CardTitle className="text-base sm:text-lg">
                  Print Documents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 sm:space-y-3">
                  {/* Package Cards - Mobile Optimized */}
                  {packages.map((pkg, idx) => (
                    <div
                      key={pkg.id || idx}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-100 dark:bg-gray-800 rounded gap-3"
                    >
                      {/* Package Info */}
                      <div className="text-left">
                        <p className="font-medium text-sm sm:text-base">
                          {/* Package {pkg.packageNumber || idx + 1} of{" "}
                          {packages.length} */}
                          {/* Package 1 of 2 Package 2 of 2 */}
                          Package {idx + 1} of {packages.length}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 break-all">
                          Tracking: {pkg.trackingNumber}
                        </p>
                      </div>

                      {/* Action Buttons - Stacked on Mobile */}
                      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        {/* Print Label Button */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const printWindow = window.open(
                              pkg.labelUrl,
                              "_blank",
                              "width=800,height=600"
                            );
                            if (printWindow) {
                              printWindow.onload = () => {
                                setTimeout(() => {
                                  printWindow.print();
                                }, 500);
                              };
                            }
                          }}
                          className="flex items-center justify-center gap-1 w-full sm:w-auto"
                        >
                          Print Label
                        </Button>

                        {/* Print Packing Slip Button */}
                        {pkg.packingSlipUrl ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const printWindow = window.open(
                                pkg.packingSlipUrl,
                                "_blank",
                                "width=800,height=600"
                              );
                              if (printWindow) {
                                printWindow.onload = () => {
                                  setTimeout(() => {
                                    printWindow.print();
                                  }, 500);
                                };
                              }
                            }}
                            className="flex items-center justify-center gap-1 w-full sm:w-auto"
                          >
                            Print Slip
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled
                            className="w-full sm:w-auto"
                          >
                            Generating...
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Print All Documents Button - Full Width */}
                  <Button
                    variant="default"
                    className="w-full h-10"
                    onClick={async () => {
                      for (let i = 0; i < packages.length; i++) {
                        const pkg = packages[i];

                        // Print label
                        if (pkg.labelUrl) {
                          const labelWindow = window.open(
                            pkg.labelUrl,
                            "_blank",
                            "width=800,height=600"
                          );
                          if (labelWindow) {
                            labelWindow.onload = () => {
                              setTimeout(() => {
                                labelWindow.print();
                              }, 500);
                            };
                          }
                          // Wait before opening next document
                          await new Promise((resolve) =>
                            setTimeout(resolve, 2000)
                          );
                        }

                        // Print packing slip
                        if (pkg.packingSlipUrl) {
                          const slipWindow = window.open(
                            pkg.packingSlipUrl,
                            "_blank",
                            "width=800,height=600"
                          );
                          if (slipWindow) {
                            slipWindow.onload = () => {
                              setTimeout(() => {
                                slipWindow.print();
                              }, 500);
                            };
                          }
                          // Wait before next package
                          await new Promise((resolve) =>
                            setTimeout(resolve, 2000)
                          );
                        }
                      }
                    }}
                  >
                    <Printer /> Print All Documents ({packages.length * 2})
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* Fallback message - Responsive Padding */
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-300">
                📄 Documents opened automatically in new tabs
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                If tabs didn't open, please check popup settings or print from
                order details page
              </p>
            </div>
          )}

          {/* Navigation Buttons - Full Width on Mobile */}
          <div className="flex gap-2 items-center w-full">
            <Button
              onClick={() => (window.location.href = "/dashboard/packing")}
              className="w-1/2 h-10"
              variant="outline"
            >
              Pack Next Order
            </Button>

            <Button
              variant="outline"
              onClick={() =>
                (window.location.href = `/dashboard/orders/${order.id}`)
              }
              className="w-1/2 h-10"
            >
              View Order Details
            </Button>
          </div>
        </div>
      </div>
    );
  }
  // ✅ CORRECT - These calculations are right!
  const totalPackingValue = order.items.reduce((sum, item) => {
    return sum + parseFloat(item.totalPrice);
  }, 0);

  // Items being packed (this is already the reduced quantity from API)
  const totalItemsToPack = order.items.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  // Back ordered items (from the API response)
  const totalItemsBackOrdered = order.items.reduce((sum, item) => {
    return sum + (item.quantityBackOrdered || 0);
  }, 0);

  // Original order total
  const totalOriginalItems = order.items.reduce((sum, item) => {
    return sum + (item.originalQuantity || item.quantity); // Use originalQuantity if available
  }, 0);

  // Get the selected box details
  const getSelectedBoxDetails = () => {
    if (selectedBox === "CUSTOM") {
      return {
        length: parseFloat(customDimensions.length) || 10,
        width: parseFloat(customDimensions.width) || 8,
        height: parseFloat(customDimensions.height) || 6,
      };
    }

    const box = BOX_TYPES.find((b) => b.id === selectedBox);
    if (!box) return { length: 10, width: 8, height: 6 };

    // Parse dimensions string like "10x8x4" into individual values
    const [length, width, height] = box.dimensions
      .split("x")
      .map((d) => parseFloat(d));

    return {
      length: length || 10,
      width: width || 8,
      height: height || 6,
    };
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Button
              variant="ghost"
              onClick={() => window.history.back()}
              className="mr-4"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Pack Order
                {/* ✅ NEW: Badge for back orders */}
                {totalItemsBackOrdered > 0 &&
                  totalItemsToPack < totalOriginalItems && (
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                      Back Order
                    </Badge>
                  )}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                {order.orderNumber}
                {totalItemsBackOrdered > 0 &&
                  totalItemsToPack < totalOriginalItems && (
                    <span className="ml-2 text-sm text-amber-600 dark:text-amber-400">
                      (Partial Fulfillment)
                    </span>
                  )}
              </p>
            </div>
          </div>
        </div>

        {/* ✅ NEW: Context Banner */}
        {order && (
          <div className="mb-6">
            {totalItemsBackOrdered > 0 &&
            totalItemsToPack < totalOriginalItems ? (
              // Back Order Context
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-amber-900 dark:text-amber-300">
                      Back Order Fulfillment
                    </h3>
                    <p className="text-sm text-amber-800 dark:text-amber-400 mt-1">
                      Packing {totalItemsToPack} of {totalOriginalItems} items.
                      The remaining {totalItemsBackOrdered} item(s) were
                      previously back-ordered and will ship separately.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-amber-700 dark:text-amber-500">
                      <span>Items to Pack: {totalItemsToPack}</span>
                      <span>Back Ordered: {totalItemsBackOrdered}</span>
                      <span>
                        This Shipment: ${totalPackingValue.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Full Order Context
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-900 dark:text-green-300">
                      Full Order - All {totalItemsToPack} items available
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                      Complete fulfillment • Order Value: $
                      {totalPackingValue.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress Steps */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => (
                <React.Fragment key={step.number}>
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        currentStep === step.number
                          ? "bg-gray-400 dark:bg-zinc-700 text-white"
                          : step.completed
                          ? "bg-green-600 text-white"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      {step.completed ? (
                        <Check className="w-6 h-6" />
                      ) : (
                        <step.icon className="w-6 h-6" />
                      )}
                    </div>
                    <span className="text-xs mt-2 text-center">
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`flex-1 h-1 mx-2 ${
                        step.completed
                          ? "bg-green-600"
                          : "bg-gray-200 dark:bg-gray-700"
                      }`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Order Info */}
          <div className="space-y-6">
            {/* Customer Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <User className="w-4 h-4 mr-2" />
                  Customer
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="font-medium">{order.customerName}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {order.customerEmail}
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex items-start">
                      <MapPin className="w-4 h-4 mr-2 mt-0.5 text-gray-500" />
                      <div className="text-sm">
                        <div>{order.shippingAddress.address1}</div>
                        {order.shippingAddress.address2 && (
                          <div>{order.shippingAddress.address2}</div>
                        )}
                        <div>
                          {order.shippingAddress.city},{" "}
                          {order.shippingAddress.province}{" "}
                          {order.shippingAddress.zip}
                        </div>
                        <div>{order.shippingAddress.country}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Items Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center">
                    <Package className="w-4 h-4 mr-2" />
                    Items ({order.items.length})
                  </span>

                  {currentStep >= 2 && (
                    <Badge
                      variant={
                        verifiedItems.size === order.items.length
                          ? "default"
                          : "secondary"
                      }
                    >
                      {verifiedItems.size}/{order.items.length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="bg-amber-50 border border-amber-200 dark:border-amber-400 dark:bg-amber-900/20 p-2 rounded-lg">
                    <p className="text-xs flex justify-center gap-2 items-center text-amber-400">
                      <TriangleAlert className="h-4 w-4" /> Click each item as
                      you pack
                    </p>
                  </div>
                  {order.items.map((item) => {
                    const isVerifying = verifyingItemId === item.id;
                    const isVerified = verifiedItems.has(item.id);

                    return (
                      <div
                        key={item.id}
                        onClick={() =>
                          currentStep >= 1 &&
                          !verifyingItemId &&
                          toggleItemVerification(item.id)
                        }
                        className={`p-2 rounded-lg transition-colors relative ${
                          isVerifying
                            ? "opacity-50 cursor-wait border-2 border-blue-400" // ✅ Blue border while loading
                            : currentStep >= 1
                            ? "cursor-pointer"
                            : ""
                        } ${
                          isVerified
                            ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 border"
                            : "bg-background hover:bg-gray-50 dark:hover:bg-gray-800"
                        }`}
                      >
                        {/* ✅ OVERLAY LOADING STATE */}
                        {isVerifying && (
                          <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-black/50 rounded-lg">
                            <div className="flex flex-col items-center gap-1">
                              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                              <span className="text-xs text-blue-600 font-medium">
                                Verifying...
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="text-sm font-medium">
                              {item.productName}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              {item.sku} • {item.weightOz.toFixed(2)} oz each
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <div className="font-semibold">
                              ×{item.quantity}
                            </div>
                            {item.originalQuantity &&
                              item.originalQuantity !== item.quantity && (
                                <div className="text-xs text-gray-500">
                                  of {item.originalQuantity}
                                </div>
                              )}

                            {/* ✅ CHECKMARK WHEN VERIFIED */}
                            {isVerified && !isVerifying && (
                              <CheckCircle className="w-5 h-5 text-green-600 mt-1" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between text-sm">
                    <span>Est. Weight:</span>
                    <span className="font-medium">
                      {calculatedWeightLbs.toFixed(2)} lbs (
                      {calculatedWeightOz.toFixed(2)} oz)
                    </span>
                  </div>

                  {/* Show item count summary */}
                  <div className="flex justify-between text-sm mt-1">
                    <span>Items to box:</span>
                    <span className="font-medium">
                      {totalItemsToPack}
                      {totalItemsBackOrdered > 0 && ` of ${totalOriginalItems}`}
                    </span>
                  </div>

                  <div className="flex justify-between font-semibold mt-1">
                    <span>Total Value:</span>
                    <span>${totalPackingValue.toFixed(2)}</span>
                  </div>

                  {totalPackingValue < parseFloat(order.totalAmount) && (
                    <div className="flex justify-between text-sm text-amber-600 mt-1">
                      <span className="flex items-center gap-1">
                        <AlertTriangle /> Back Ordered:
                      </span>
                      <span>
                        {totalItemsBackOrdered} items
                        {/* ($
                        {(
                          parseFloat(order.totalAmount) - totalPackingValue
                        ).toFixed(2)}
                        ) */}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Packing Steps */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1: Pack Items */}
            {currentStep === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Package className="w-5 h-5 mr-2" />
                    Step 1: Pack & Verify Items
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* ADD IMAGE UPLOADER HERE - Compact version */}
                  <OrderImageUploader
                    orderId={order.id}
                    orderNumber={order.orderNumber}
                    customerName={order.customerName || "Customer"}
                    existingImages={order.images || []} // if you have existing images
                    onUploadSuccess={() => {
                      console.log("Image uploaded!");
                      // Optional: refresh order data
                    }}
                    compact={true} // Use compact layout for inline display
                  />

                  <div className="space-y-4 mt-4">
                    {/* <div className="bg-red-50 border border-red-200 dark:border-red-400 dark:bg-red-900/20 p-4 rounded-lg">
                      <p className="text-sm flex items-center gap-1 text-red-400">
                        <Dot />
                        Click each item as you pack
                        <strong>
                          {BOX_TYPES.find((b) => b.id === selectedBox)?.name}
                        </strong>
                      </p>
                    </div> */}

                    {/* ... packing photos and materials sections ... */}

                    {/* ✅ ADD THIS BUTTON SECTION */}
                    <Button
                      onClick={proceedToCreateLabel}
                      disabled={!canProceedToStep(2) || isPacking}
                      className="w-full bg-blue-500 hover:bg-blue-600"
                    >
                      {isPacking
                        ? "Marking as Packed..."
                        : "Continue to Create Label"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Create Shipping Label */}
            {currentStep === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-md md:text-xl">
                    <Truck className="w-5 h-5 mr-2" />
                    Step 2: Create Shipping Label
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ShippingLabelForm
                    order={order}
                    embedded={true}
                    initialWeight={calculatedWeightLbs}
                    initialDimensions={getSelectedBoxDetails()}
                    onSuccess={handleLabelSuccess}
                    onCancel={() => setCurrentStep(1)}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
