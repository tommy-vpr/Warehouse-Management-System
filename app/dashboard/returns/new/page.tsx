// dashboard/returns/new/page.tsx
// Customer Return Portal - UPDATED with Return Label Display

"use client";

import { useState } from "react";
import {
  OrderLookupResponse,
  CreateReturnRequest,
  ReturnReason,
  RefundMethod,
} from "@/types/returns";
import ButtonSpinningLoader from "@/components/ButtonSpinningLoader";

// ✅ NEW: Return label type
type ReturnLabel = {
  trackingNumber: string;
  labelUrl: string;
  cost: number;
  carrier: string;
};

export default function NewReturnPage(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [step, setStep] = useState<
    "lookup" | "select-items" | "confirm" | "complete"
  >("lookup");

  // Step 1: Order Lookup
  const [orderNumber, setOrderNumber] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [lookupResult, setLookupResult] = useState<OrderLookupResponse | null>(
    null
  );
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  // Step 2: Select Items
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>(
    {}
  );
  const [returnReason, setReturnReason] = useState<ReturnReason>(
    ReturnReason.NO_LONGER_NEEDED
  );
  const [reasonDetails, setReasonDetails] = useState("");
  const [refundMethod, setRefundMethod] = useState<RefundMethod>(
    RefundMethod.ORIGINAL_PAYMENT
  );

  // Step 3: Result
  const [rmaNumber, setRmaNumber] = useState<string | null>(null);
  const [returnOrderId, setReturnOrderId] = useState<string | null>(null);
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [returnLabel, setReturnLabel] = useState<ReturnLabel | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [labelWarning, setLabelWarning] = useState<string | null>(null);

  // ✅ NEW: State for requesting additional labels
  const [requestingAdditionalLabel, setRequestingAdditionalLabel] =
    useState(false);
  const [additionalLabelError, setAdditionalLabelError] = useState<
    string | null
  >(null);

  // Handle order lookup
  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupLoading(true);
    setLookupError(null);

    try {
      const response = await fetch("/api/returns/lookup-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, customerEmail }),
      });

      const data: OrderLookupResponse = await response.json();

      if (!data.success) {
        setLookupError(
          data.error || "Order not found or ineligible for return"
        );
        return;
      }

      setLookupResult(data);
      setStep("select-items");
    } catch (error) {
      setLookupError("Failed to lookup order. Please try again.");
    } finally {
      setLookupLoading(false);
    }
  };

  // Handle item quantity change
  const handleQuantityChange = (productVariantId: string, quantity: number) => {
    if (quantity === 0) {
      const newSelected = { ...selectedItems };
      delete newSelected[productVariantId];
      setSelectedItems(newSelected);
    } else {
      setSelectedItems({
        ...selectedItems,
        [productVariantId]: quantity,
      });
    }
  };

  // Calculate total refund estimate
  const calculateEstimatedRefund = () => {
    if (!lookupResult?.order) return 0;

    return lookupResult.order.items.reduce((total, item) => {
      const qty = selectedItems[item.productVariantId] || 0;
      return total + item.unitPrice * qty;
    }, 0);
  };

  // Handle return creation
  const handleCreateReturn = async () => {
    if (!lookupResult?.order) return;

    const itemsToReturn = Object.entries(selectedItems).map(
      ([productVariantId, quantity]) => ({
        productVariantId,
        quantityRequested: quantity,
      })
    );

    if (itemsToReturn.length === 0) {
      setCreateError("Please select at least one item to return");
      return;
    }

    setCreateLoading(true);
    setCreateError(null);
    setLabelWarning(null);

    try {
      const request: CreateReturnRequest = {
        orderId: lookupResult.order.id,
        customerEmail: lookupResult.order.customerEmail,
        reason: returnReason,
        reasonDetails: reasonDetails || undefined,
        refundMethod,
        items: itemsToReturn,
      };

      const response = await fetch("/api/returns/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      const data = await response.json();

      if (!data.success) {
        setCreateError(data.error || "Failed to create return");
        return;
      }

      setRmaNumber(data.returnOrder.rmaNumber);
      setReturnOrderId(data.returnOrder.id);
      setApprovalRequired(data.returnOrder.approvalRequired);

      // ✅ NEW: Check if label was generated
      if (data.returnLabel) {
        setReturnLabel(data.returnLabel);
        console.log("✅ Return label received:", data.returnLabel);
      } else if (data.warning) {
        setLabelWarning(data.warning);
        console.warn("⚠️ Label warning:", data.warning);
      }

      setStep("complete");
    } catch (error) {
      setCreateError("Failed to create return. Please try again.");
    } finally {
      setCreateLoading(false);
    }
  };

  // ✅ NEW: Handle request for additional label
  const handleRequestAdditionalLabel = async () => {
    if (!returnOrderId) return;

    setRequestingAdditionalLabel(true);
    setAdditionalLabelError(null);

    try {
      const response = await fetch("/api/returns/request-additional-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnOrderId }),
      });

      const data = await response.json();

      if (!data.success) {
        setAdditionalLabelError(
          data.error || "Failed to generate additional label"
        );
        return;
      }

      // Open the new label in a new tab
      if (data.labelUrl) {
        window.open(data.labelUrl, "_blank");
        alert(`Additional label created!\nTracking: ${data.trackingNumber}`);
      }
    } catch (error) {
      setAdditionalLabelError(
        "Failed to request additional label. Please try again."
      );
    } finally {
      setRequestingAdditionalLabel(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Start a Return
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Returns accepted within 30 days of delivery
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4">
            <div
              className={`flex items-center ${
                step === "lookup"
                  ? "text-green-600 dark:text-green-400"
                  : "text-gray-400 dark:text-gray-500"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                  step === "lookup"
                    ? "border-green-600 dark:border-green-400 bg-green-50 dark:bg-green-950"
                    : "border-gray-300 dark:border-gray-600"
                }`}
              >
                1
              </div>
              <span className="ml-2 text-sm font-medium">Find Order</span>
            </div>
            <div className="w-12 h-0.5 bg-gray-300 dark:bg-gray-600" />
            <div
              className={`flex items-center ${
                step === "select-items" || step === "confirm"
                  ? "text-green-600 dark:text-green-400"
                  : "text-gray-400 dark:text-gray-500"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                  step === "select-items" || step === "confirm"
                    ? "border-green-600 dark:border-green-400 bg-green-50 dark:bg-green-950"
                    : "border-gray-300 dark:border-gray-600"
                }`}
              >
                2
              </div>
              <span className="ml-2 text-sm font-medium">Select Items</span>
            </div>
            <div className="w-12 h-0.5 bg-gray-300 dark:bg-gray-600" />
            <div
              className={`flex items-center ${
                step === "complete"
                  ? "text-green-600 dark:text-green-400"
                  : "text-gray-400 dark:text-gray-500"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                  step === "complete"
                    ? "border-green-600 dark:border-green-400 bg-green-50 dark:bg-green-950"
                    : "border-gray-300 dark:border-gray-600"
                }`}
              >
                3
              </div>
              <span className="ml-2 text-sm font-medium">Confirm</span>
            </div>
          </div>
        </div>

        {/* Step 1: Order Lookup */}
        {step === "lookup" && (
          <div className="bg-white dark:bg-zinc-800/50 shadow-sm dark:shadow-zinc-900/50 rounded-lg p-6 border border-gray-200 dark:border-zinc-700/50">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
              Find Your Order
            </h2>
            <form onSubmit={handleLookup} className="space-y-4">
              <div>
                <label
                  htmlFor="orderNumber"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Order Number
                </label>

                <div className="relative mt-1">
                  <span className="absolute left-3 top-2.5 text-gray-500 dark:text-gray-400 select-none">
                    #
                  </span>
                  <input
                    type="text"
                    id="orderNumber"
                    value={orderNumber.replace(/^#/, "")}
                    onChange={(e) => {
                      const input = e.target.value.replace(/^#*/, "");
                      setOrderNumber("#" + input);
                    }}
                    placeholder="1234"
                    required
                    className="pl-6 p-2 block w-full rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="customerEmail"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Email Address
                </label>
                <input
                  type="email"
                  id="customerEmail"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="mt-1 p-2 block w-full rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Enter the email used when placing the order
                </p>
              </div>

              {lookupError && (
                <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 p-4">
                  <div className="flex">
                    <div className="text-sm text-red-700 dark:text-red-400">
                      {lookupError}
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={lookupLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition"
              >
                {lookupLoading ? <ButtonSpinningLoader /> : "Find Order"}
              </button>
            </form>
          </div>
        )}

        {/* Step 2: Select Items */}
        {step === "select-items" && lookupResult?.order && (
          <div className="bg-white dark:bg-zinc-800/50 shadow-sm dark:shadow-zinc-900/50 rounded-lg p-6 border border-gray-200 dark:border-zinc-700/50">
            <div className="mb-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Select Items to Return
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Order {lookupResult.order.orderNumber} · Shipped on{" "}
                {lookupResult.order.shippedAt
                  ? new Date(lookupResult.order.shippedAt).toLocaleDateString()
                  : "N/A"}
              </p>
              {lookupResult.eligibility.daysRemaining !== undefined && (
                <p className="mt-1 text-sm text-amber-600 dark:text-amber-500">
                  {lookupResult.eligibility.daysRemaining} days remaining to
                  return
                </p>
              )}
            </div>

            {/* Items List */}
            <div className="space-y-4 mb-6">
              {lookupResult.order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start space-x-4 p-4 border border-gray-200 dark:border-zinc-700 rounded-lg"
                >
                  <div className="flex-shrink-0">
                    <div className="w-20 h-20 bg-gray-200 dark:bg-zinc-700 rounded-lg flex items-center justify-center">
                      <span className="text-xs text-gray-400">No image</span>
                    </div>
                  </div>

                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {item.name}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      SKU: {item.sku}
                    </p>
                    <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                      ${item.unitPrice.toFixed(2)} each
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Ordered: {item.quantity} · Available to return:{" "}
                      {item.quantityAvailable}
                    </p>
                  </div>

                  <div className="flex-shrink-0">
                    <label className="block text-xs text-gray-700 dark:text-gray-300 mb-1">
                      Return Qty
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={item.quantityAvailable}
                      value={selectedItems[item.productVariantId] || 0}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 0;
                        const clampedValue = Math.max(
                          0,
                          Math.min(value, item.quantityAvailable)
                        );
                        handleQuantityChange(
                          item.productVariantId,
                          clampedValue
                        );
                      }}
                      className="block w-20 rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm p-2"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Max: {item.quantityAvailable}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Return Reason */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Reason for Return
                </label>
                <select
                  value={returnReason}
                  onChange={(e) =>
                    setReturnReason(e.target.value as ReturnReason)
                  }
                  className="block w-full rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 p-2"
                >
                  <option value={ReturnReason.NO_LONGER_NEEDED}>
                    No longer needed
                  </option>
                  <option value={ReturnReason.DEFECTIVE}>
                    Defective or damaged
                  </option>
                  <option value={ReturnReason.WRONG_ITEM}>
                    Wrong item sent
                  </option>
                  <option value={ReturnReason.NOT_AS_DESCRIBED}>
                    Not as described
                  </option>
                  <option value={ReturnReason.ORDERED_BY_MISTAKE}>
                    Ordered by mistake
                  </option>
                  <option value={ReturnReason.BETTER_PRICE}>
                    Found better price
                  </option>
                  <option value={ReturnReason.DAMAGED_SHIPPING}>
                    Damaged during shipping
                  </option>
                  <option value={ReturnReason.EXPIRED}>Product expired</option>
                  <option value={ReturnReason.OTHER}>Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Additional Details (Optional)
                </label>
                <textarea
                  value={reasonDetails}
                  onChange={(e) => setReasonDetails(e.target.value)}
                  rows={3}
                  placeholder="Please provide any additional details about your return..."
                  className="p-2 block w-full rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Refund Method
                </label>
                <select
                  value={refundMethod}
                  onChange={(e) =>
                    setRefundMethod(e.target.value as RefundMethod)
                  }
                  className="block w-full rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 p-2"
                >
                  <option value={RefundMethod.ORIGINAL_PAYMENT}>
                    Original payment method
                  </option>
                  <option value={RefundMethod.STORE_CREDIT}>
                    Store credit
                  </option>
                  <option value={RefundMethod.REPLACEMENT}>
                    Replacement product
                  </option>
                </select>
              </div>
            </div>

            {/* Estimated Refund */}
            <div className="bg-gray-50 dark:bg-zinc-900/50 rounded-lg p-4 mb-6 border border-gray-200 dark:border-zinc-700">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  Estimated Refund:
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  ${calculateEstimatedRefund().toFixed(2)}
                </span>
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Final refund amount will be determined after inspection.
                {returnReason !== ReturnReason.DEFECTIVE &&
                  returnReason !== ReturnReason.WRONG_ITEM &&
                  " A 15% restocking fee may apply."}
              </p>
            </div>

            {createError && (
              <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 p-4 mb-4">
                <div className="text-sm text-red-700 dark:text-red-400">
                  {createError}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex space-x-3">
              <button
                onClick={() => setStep("lookup")}
                className="flex-1 py-2 px-4 border border-gray-300 dark:border-zinc-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 transition"
              >
                Back
              </button>
              <button
                onClick={handleCreateReturn}
                disabled={
                  createLoading || Object.keys(selectedItems).length === 0
                }
                className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {createLoading ? "Creating..." : "Create Return"}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Complete - ✅ UPDATED with Return Label Display */}
        {step === "complete" && rmaNumber && (
          <div className="bg-white dark:bg-zinc-800/50 shadow-sm dark:shadow-zinc-900/50 rounded-lg p-6 border border-gray-200 dark:border-zinc-700/50">
            <div className="text-center">
              {/* Success Icon */}
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                <svg
                  className="h-6 w-6 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Return Created Successfully!
              </h2>

              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900/50">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Your RMA Number:
                </p>
                <p className="text-3xl font-mono font-bold text-blue-600 dark:text-blue-400">
                  {rmaNumber}
                </p>
              </div>

              {/* ✅ NEW: Display Return Label if generated */}
              {returnLabel && (
                <div className="mt-6 p-6 bg-green-50 dark:bg-green-950/30 border-2 border-green-400 dark:border-green-700 rounded-lg">
                  <div className="flex items-center justify-center mb-4">
                    <svg
                      className="h-6 w-6 text-green-600 dark:text-green-400 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <h3 className="text-lg font-bold text-green-900 dark:text-green-200">
                      Prepaid Return Label Created!
                    </h3>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 rounded p-4 mb-4 border border-green-200 dark:border-green-900/50">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Tracking Number:
                    </p>
                    <p className="text-xl font-mono font-bold text-gray-900 dark:text-gray-100">
                      {returnLabel.trackingNumber}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Carrier: {returnLabel.carrier} · Cost: $
                      {returnLabel.cost.toFixed(2)}
                    </p>
                  </div>

                  <a
                    href={returnLabel.labelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-3 px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 font-bold text-lg mb-3 transition"
                  >
                    📄 Download Return Label
                  </a>

                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Print this label and attach it to the outside of your
                    package
                  </p>
                </div>
              )}

              {/* ✅ NEW: Show warning if label generation failed */}
              {labelWarning && (
                <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-400 dark:border-amber-700 rounded-lg">
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    <strong>⚠️ Note:</strong> {labelWarning}
                  </p>
                </div>
              )}

              {approvalRequired ? (
                <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900/50">
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    <strong>Approval Required:</strong> Your return requires
                    manager approval. You will receive an email within 1-2
                    business days with further instructions.
                  </p>
                </div>
              ) : (
                <div className="mt-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Next Steps
                  </h3>
                  <div className="bg-gray-50 dark:bg-zinc-900/50 rounded-lg p-4 mb-4 border border-gray-200 dark:border-zinc-700">
                    <ol className="text-left space-y-3 text-sm text-gray-800 dark:text-gray-200">
                      <li className="flex items-start">
                        <span className="font-bold mr-2 text-lg">1.</span>
                        <div>
                          <strong>Print Your Packing Slip</strong>
                          <p className="text-gray-600 dark:text-gray-400 mt-1">
                            Click below to print your packing slip with barcode.
                            The warehouse needs this to process your return.
                          </p>
                        </div>
                      </li>
                      {returnLabel && (
                        <li className="flex items-start">
                          <span className="font-bold mr-2 text-lg">2.</span>
                          <div>
                            <strong>Print Your Return Label</strong>
                            <p className="text-gray-600 dark:text-gray-400 mt-1">
                              Use the prepaid return label above (already
                              generated for you!)
                            </p>
                          </div>
                        </li>
                      )}
                      <li className="flex items-start">
                        <span className="font-bold mr-2 text-lg">
                          {returnLabel ? "3" : "2"}.
                        </span>
                        <div>
                          <strong>Pack Items Securely</strong>
                          <p className="text-gray-600 dark:text-gray-400 mt-1">
                            Place packing slip INSIDE the box. Use original
                            packaging if possible.
                          </p>
                        </div>
                      </li>
                      <li className="flex items-start">
                        <span className="font-bold mr-2 text-lg">
                          {returnLabel ? "4" : "3"}.
                        </span>
                        <div>
                          <strong>Ship It!</strong>
                          <p className="text-gray-600 dark:text-gray-400 mt-1">
                            Attach return label to OUTSIDE of box and drop off
                            at USPS.
                          </p>
                        </div>
                      </li>
                    </ol>
                  </div>

                  {/* PRIMARY ACTION: Print Packing Slip */}
                  <a
                    href={`/dashboard/returns/packing-slip/${rmaNumber}`}
                    target="_blank"
                    className="block w-full py-4 px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 font-bold text-lg mb-3 transition"
                  >
                    Print Packing Slip with Barcode
                  </a>

                  {/* ✅ NEW: Request Additional Label Button */}
                  {returnLabel && (
                    <div className="mt-4 p-4 bg-gray-50 dark:bg-zinc-900/50 border border-gray-300 dark:border-zinc-700 rounded-lg">
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                        Need to use multiple boxes?
                      </p>
                      {additionalLabelError && (
                        <div className="mb-3 p-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded text-sm text-red-700 dark:text-red-400">
                          {additionalLabelError}
                        </div>
                      )}
                      <button
                        onClick={handleRequestAdditionalLabel}
                        disabled={requestingAdditionalLabel}
                        className="w-full py-2 px-4 border-2 border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 font-medium disabled:opacity-50 transition"
                      >
                        {requestingAdditionalLabel
                          ? "Generating..."
                          : "📦 Request Additional Return Label"}
                      </button>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Click to generate another prepaid label for a second box
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6 flex flex-col space-y-2">
                <button
                  onClick={() =>
                    window.open(
                      `/dashboard/returns/packing-slip/${rmaNumber}`,
                      "_blank"
                    )
                  }
                  className="w-full py-2 px-4 border border-gray-300 dark:border-zinc-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 transition"
                >
                  View Packing Slip Again
                </button>
                <button
                  onClick={() => {
                    setStep("lookup");
                    setOrderNumber("");
                    setCustomerEmail("");
                    setSelectedItems({});
                    setRmaNumber(null);
                    setReturnLabel(null);
                    setReturnOrderId(null);
                    setLabelWarning(null);
                  }}
                  className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 transition"
                >
                  Start Another Return
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
