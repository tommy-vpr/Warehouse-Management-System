// dashboard/returns/page.tsx
// Returns Management Dashboard with metrics and pipeline view

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReturnMetrics {
  period: {
    start: string;
    end: string;
  };
  totals: {
    returnCount: number;
    returnRate: number;
    totalRefundAmount: number;
    averageRefundAmount: number;
    averageProcessingDays: number;
  };
  byReason: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
  byCondition: Array<{
    condition: string;
    count: number;
    percentage: number;
  }>;
  restockingMetrics: {
    totalReceived: number;
    totalRestocked: number;
    totalDisposed: number;
    restockRate: number;
  };
}

interface ReturnOrder {
  id: string;
  rmaNumber: string;
  status: string;
  customerName: string;
  customerEmail: string;
  reason: string;
  refundAmount?: number;
  createdAt: string;
  order: {
    orderNumber: string;
  };
}

type StatusFilter =
  | "ALL"
  | "PENDING"
  | "APPROVED"
  | "IN_TRANSIT"
  | "RECEIVED"
  | "INSPECTING"
  | "REFUND_PENDING"
  | "REFUNDED";

export default function ReturnsDashboard(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [metrics, setMetrics] = useState<ReturnMetrics | null>(null);
  const [returns, setReturns] = useState<ReturnOrder[]>([]);
  const [filteredReturns, setFilteredReturns] = useState<ReturnOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
    fetchReturns();
  }, []);

  useEffect(() => {
    let filtered = returns;

    // Status filter
    if (statusFilter !== "ALL") {
      filtered = filtered.filter((r) => r.status === statusFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.rmaNumber.toLowerCase().includes(query) ||
          r.customerName.toLowerCase().includes(query) ||
          r.customerEmail.toLowerCase().includes(query) ||
          r.order.orderNumber.toLowerCase().includes(query)
      );
    }

    setFilteredReturns(filtered);
  }, [statusFilter, searchQuery, returns]);

  const fetchMetrics = async () => {
    try {
      // Get current month metrics
      const startDate = new Date();
      startDate.setDate(1); // First day of month
      const endDate = new Date();

      const response = await fetch(
        `/api/returns/dashboard?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
      );
      const data = await response.json();
      setMetrics(data);
    } catch (err) {
      console.error("Failed to fetch metrics");
    }
  };

  const fetchReturns = async () => {
    try {
      const response = await fetch("/api/returns");
      const data = await response.json();
      setReturns(data);
      setFilteredReturns(data);
    } catch (err) {
      console.error("Failed to fetch returns");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      APPROVED:
        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      IN_TRANSIT:
        "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      RECEIVED:
        "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
      INSPECTING:
        "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
      INSPECTION_COMPLETE:
        "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
      RESTOCKING:
        "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
      REFUND_PENDING:
        "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
      REFUNDED:
        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      CLOSED:
        "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400",
    };
    return (
      colors[status] ||
      "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400"
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600 dark:text-gray-400">Loading returns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      {/* Header */}
      <div className="">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-200">
                Returns Management
              </h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                Monitor and manage product returns
              </p>
            </div>
            <div className="flex items-center gap-2 mt-2 sm:mt-0">
              <Link href="/dashboard/returns/new">
                <Button variant={"outline"}>Create Return</Button>
              </Link>
              <Link href="/dashboard/warehouse/returns/receive">
                <Button variant={"default"}>Receive Return</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Metrics Cards */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white dark:bg-zinc-800/50 rounded-lg shadow-sm dark:shadow-zinc-900/50 p-4 border border-gray-200 dark:border-zinc-700/50">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                This Month
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {metrics.totals.returnCount}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                returns
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-800/50 rounded-lg shadow-sm dark:shadow-zinc-900/50 p-4 border border-gray-200 dark:border-zinc-700/50">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Return Rate
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {metrics.totals.returnRate.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                of orders
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-800/50 rounded-lg shadow-sm dark:shadow-zinc-900/50 p-4 border border-gray-200 dark:border-zinc-700/50">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Avg Refund
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                ${metrics.totals.averageRefundAmount.toFixed(0)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                per return
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-800/50 rounded-lg shadow-sm dark:shadow-zinc-900/50 p-4 border border-gray-200 dark:border-zinc-700/50">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Avg Process Time
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {metrics.totals.averageProcessingDays.toFixed(1)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">days</p>
            </div>

            <div className="bg-white dark:bg-zinc-800/50 rounded-lg shadow-sm dark:shadow-zinc-900/50 p-4 border border-gray-200 dark:border-zinc-700/50">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Restock Rate
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {metrics.restockingMetrics.restockRate.toFixed(0)}%
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                restocked
              </p>
            </div>
          </div>
        )}

        {/* Charts Row */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Return Reasons */}
            <div className="bg-white dark:bg-zinc-800/50 rounded-lg shadow-sm dark:shadow-zinc-900/50 p-6 border border-gray-200 dark:border-zinc-700/50">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                Top Return Reasons
              </h3>
              <div className="space-y-3">
                {metrics.byReason.slice(0, 5).map((reason) => (
                  <div key={reason.reason}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 dark:text-gray-300">
                        {reason.reason.replace(/_/g, " ")}
                      </span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {reason.count}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-2">
                      <div
                        className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full"
                        style={{ width: `${reason.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Restocking Breakdown */}
            <div className="bg-white dark:bg-zinc-800/50 rounded-lg shadow-sm dark:shadow-zinc-900/50 p-6 border border-gray-200 dark:border-zinc-700/50">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                Disposition Breakdown
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-green-500 dark:bg-green-400 rounded-full mr-3"></div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Restocked
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900 dark:text-gray-100">
                      {metrics.restockingMetrics.totalRestocked}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {metrics.restockingMetrics.restockRate.toFixed(0)}%
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-red-500 dark:bg-red-400 rounded-full mr-3"></div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Disposed
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900 dark:text-gray-100">
                      {metrics.restockingMetrics.totalDisposed}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {(
                        (metrics.restockingMetrics.totalDisposed /
                          metrics.restockingMetrics.totalReceived) *
                        100
                      ).toFixed(0)}
                      %
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-200 dark:border-zinc-700">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Total Received
                    </span>
                    <span className="font-bold text-gray-900 dark:text-gray-100">
                      {metrics.restockingMetrics.totalReceived}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters and Search - Responsive Layout */}
        <div className="bg-white dark:bg-zinc-800/50 rounded-lg shadow-sm dark:shadow-zinc-900/50 p-4 mb-6 border border-gray-200 dark:border-zinc-700/50">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Status Filter */}
            <div className="w-full sm:w-auto">
              {/* Mobile dropdown */}
              <div className="sm:hidden">
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as StatusFilter)
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-100 text-sm"
                >
                  {(
                    [
                      "ALL",
                      "PENDING",
                      "APPROVED",
                      "IN_TRANSIT",
                      "RECEIVED",
                      "INSPECTING",
                      "REFUND_PENDING",
                      "REFUNDED",
                    ] as StatusFilter[]
                  ).map((status) => (
                    <option key={status} value={status}>
                      {status.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>

              {/* Desktop button group */}
              <div className="hidden sm:flex flex-wrap gap-2">
                {(
                  [
                    "ALL",
                    "PENDING",
                    "APPROVED",
                    "IN_TRANSIT",
                    "RECEIVED",
                    "INSPECTING",
                    "REFUND_PENDING",
                    "REFUNDED",
                  ] as StatusFilter[]
                ).map((status) => (
                  <Button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    size="sm"
                    className={`rounded-full text-xs font-medium transition-colors ${
                      statusFilter === status
                        ? "bg-zinc-800 text-white dark:bg-gray-200 dark:text-zinc-800"
                        : "bg-transparent text-zinc-800 hover:bg-zinc-800 hover:text-white dark:text-gray-200 dark:hover:bg-gray-200 dark:hover:text-zinc-800"
                    }`}
                  >
                    {status.replace(/_/g, " ")}
                  </Button>
                ))}
              </div>
            </div>

            {/* Search */}
            <div className="w-full sm:w-auto sm:max-w-xs">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search RMA, customer, order..."
                className="block w-full px-3 py-2 rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:focus:border-blue-400 dark:focus:ring-blue-400 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Returns List */}
        <div className="bg-white dark:bg-zinc-800/50 rounded-lg shadow-sm dark:shadow-zinc-900/50 overflow-hidden border border-gray-200 dark:border-zinc-700/50">
          {/* TABLE VIEW (Desktop and up) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
              <thead className="bg-gray-50 dark:bg-zinc-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    RMA Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Order
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Reason
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Refund
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-zinc-800/50 divide-y divide-gray-200 dark:divide-zinc-700">
                {filteredReturns.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                    >
                      No returns found
                    </td>
                  </tr>
                ) : (
                  filteredReturns.map((returnOrder) => (
                    <tr
                      key={returnOrder.id}
                      className="hover:bg-gray-50 dark:hover:bg-zinc-700/30 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
                        {returnOrder.rmaNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-gray-100">
                          {returnOrder.customerName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {returnOrder.customerEmail}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                        {returnOrder.order.orderNumber}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {returnOrder.reason.replace(/_/g, " ")}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 inline-flex text-[10px] leading-5 font-semibold rounded-full ${getStatusColor(
                            returnOrder.status
                          )}`}
                        >
                          {returnOrder.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                        {returnOrder.refundAmount
                          ? `$${returnOrder.refundAmount.toFixed(2)}`
                          : "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {new Date(returnOrder.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium">
                        <Link
                          href={`/dashboard/returns/${returnOrder.rmaNumber}`}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* CARD VIEW (Mobile only) */}
          <div className="sm:hidden space-y-3 p-4">
            {filteredReturns.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400">
                No returns found
              </p>
            ) : (
              filteredReturns.map((rma) => (
                <div
                  key={rma.id}
                  className="bg-white dark:bg-zinc-800 rounded-md shadow-sm border border-gray-200 dark:border-zinc-700 p-3"
                >
                  {/* Header: RMA + Status */}
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-mono text-xs text-gray-700 dark:text-gray-300">
                      {rma.rmaNumber}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${getStatusColor(
                        rma.status
                      )}`}
                    >
                      {rma.status.replace(/_/g, " ")}
                    </span>
                  </div>

                  {/* Core Info */}
                  <div className="text-sm text-gray-800 dark:text-gray-200 space-y-1">
                    <p className="text-xs font-medium">
                      {rma.customerName}
                      <span className="text-gray-500 dark:text-gray-400 text-xs ml-1">
                        ({rma.order.orderNumber})
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {rma.reason.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(rma.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Action */}
                  <div className="mt-2 text-right">
                    <Link
                      href={`/dashboard/returns/${rma.rmaNumber}`}
                      className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      View
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
