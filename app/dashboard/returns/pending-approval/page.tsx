// dashboard/returns/pending-approval/page.tsx
// Manager dashboard to approve/reject high-value returns

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface PendingReturn {
  id: string;
  rmaNumber: string;
  customerName: string;
  customerEmail: string;
  reason: string;
  reasonDetails?: string;
  totalAmount: number;
  itemCount: number;
  createdAt: string;
  order: {
    orderNumber: string;
    totalAmount: number;
  };
  items: Array<{
    productVariant: {
      name: string;
      sku: string;
    };
    quantityRequested: number;
    unitPrice: number;
  }>;
}

export default function PendingApprovalPage(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [pendingReturns, setPendingReturns] = useState<PendingReturn[]>([]);
  const [selectedReturn, setSelectedReturn] = useState<PendingReturn | null>(
    null
  );
  const [rejectionReason, setRejectionReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const router = useRouter();

  useEffect(() => {
    fetchPendingReturns();
  }, []);

  const fetchPendingReturns = async () => {
    try {
      const response = await fetch("/api/returns?status=PENDING");
      const data = await response.json();
      setPendingReturns(data);
    } catch (err) {
      console.error("Failed to fetch pending returns");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (returnId: string, rmaNumber: string) => {
    if (!confirm("Approve this return request?")) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/returns/${rmaNumber}/approve`, {
        method: "POST",
      });

      if (response.ok) {
        alert(
          "Return approved! Customer will receive shipping label via email."
        );
        fetchPendingReturns();
        setSelectedReturn(null);
      }
    } catch (err) {
      alert("Failed to approve return");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (returnId: string, rmaNumber: string) => {
    if (!rejectionReason.trim()) {
      alert("Please provide a rejection reason");
      return;
    }

    if (!confirm("Reject this return request?")) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/returns/${rmaNumber}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectionReason }),
      });

      if (response.ok) {
        alert("Return rejected. Customer has been notified.");
        fetchPendingReturns();
        setSelectedReturn(null);
        setRejectionReason("");
      }
    } catch (err) {
      alert("Failed to reject return");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600 dark:text-gray-400">
            Loading pending returns...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-800/50 border-b border-gray-200 dark:border-zinc-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <button
                onClick={() => router.push("/dashboard/inventory/receive")}
                className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 mb-4 transition"
              >
                <ArrowLeft className="w-5 h-5" />
                Back to Receiving
              </button>

              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    Pending Approvals
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400">
                    Review and approve/reject return requests
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-zinc-800/50 rounded-lg shadow-sm dark:shadow-zinc-900/50 p-4 border border-gray-200 dark:border-zinc-700/50">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Pending Approval
            </p>
            <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-500">
              {pendingReturns.length}
            </p>
          </div>
          <div className="bg-white dark:bg-zinc-800/50 rounded-lg shadow-sm dark:shadow-zinc-900/50 p-4 border border-gray-200 dark:border-zinc-700/50">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Total Value
            </p>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              $
              {pendingReturns
                .reduce((sum, r) => sum + r.totalAmount, 0)
                .toFixed(2)}
            </p>
          </div>
          <div className="bg-white dark:bg-zinc-800/50 rounded-lg shadow-sm dark:shadow-zinc-900/50 p-4 border border-gray-200 dark:border-zinc-700/50">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Avg Value
            </p>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              $
              {pendingReturns.length > 0
                ? (
                    pendingReturns.reduce((sum, r) => sum + r.totalAmount, 0) /
                    pendingReturns.length
                  ).toFixed(2)
                : "0.00"}
            </p>
          </div>
        </div>

        {pendingReturns.length === 0 ? (
          <div className="bg-white dark:bg-zinc-800/50 rounded-lg shadow-sm dark:shadow-zinc-900/50 p-12 text-center border border-gray-200 dark:border-zinc-700/50">
            <div className="text-6xl mb-4">✓</div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              All Caught Up!
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              No returns pending approval at this time.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {pendingReturns.map((returnOrder) => (
              <div
                key={returnOrder.id}
                className="bg-white dark:bg-zinc-800/50 rounded-lg shadow-sm dark:shadow-zinc-900/50 border border-gray-200 dark:border-zinc-700/50"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                        {returnOrder.rmaNumber}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Created{" "}
                        {new Date(returnOrder.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        ${returnOrder.totalAmount.toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {returnOrder.itemCount} items
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-gray-50 dark:bg-zinc-900/50 rounded border border-gray-200 dark:border-zinc-700">
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Customer
                      </p>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {returnOrder.customerName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {returnOrder.customerEmail}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Original Order
                      </p>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {returnOrder.order.orderNumber}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Order Total: ${returnOrder.order.totalAmount.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Return Reason
                    </p>
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      {returnOrder.reason.replace(/_/g, " ")}
                    </p>
                    {returnOrder.reasonDetails && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 italic mt-1">
                        "{returnOrder.reasonDetails}"
                      </p>
                    )}
                  </div>

                  {/* Items */}
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Items
                    </p>
                    <div className="border border-gray-200 dark:border-zinc-700 rounded">
                      {returnOrder.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-zinc-700 last:border-b-0"
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {item.productVariant.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              SKU: {item.productVariant.sku}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {item.quantityRequested} × $
                              {item.unitPrice.toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              $
                              {(
                                item.quantityRequested * item.unitPrice
                              ).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setSelectedReturn(returnOrder)}
                      className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 text-white rounded transition"
                      disabled={actionLoading}
                    >
                      Reject
                    </button>
                    <button
                      onClick={() =>
                        handleApprove(returnOrder.id, returnOrder.rmaNumber)
                      }
                      className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 text-white rounded transition"
                      disabled={actionLoading}
                    >
                      {actionLoading ? "Processing..." : "Approve"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rejection Modal */}
      {selectedReturn && (
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6 border border-gray-200 dark:border-zinc-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
              Reject Return {selectedReturn.rmaNumber}
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Rejection Reason *
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                placeholder="Explain why this return is being rejected..."
                className="block w-full rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 shadow-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 p-2"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Customer will receive this explanation via email
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setSelectedReturn(null);
                  setRejectionReason("");
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  handleReject(selectedReturn.id, selectedReturn.rmaNumber)
                }
                disabled={!rejectionReason.trim() || actionLoading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition"
              >
                {actionLoading ? "Processing..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
