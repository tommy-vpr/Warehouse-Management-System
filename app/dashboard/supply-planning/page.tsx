"use client";

import { useState, useEffect } from "react";
import {
  Search,
  Download,
  TrendingUp,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ShoppingCart,
  Package,
} from "lucide-react";

interface Variant {
  id: string;
  sku: string;
  title: string;
  in_stock?: number;
  replenishment?: number;
  oos?: number;
  cost_price?: number;
  vendor_id?: string;
}

interface PurchaseOrder {
  id: string;
  reference: string;
  vendor_name?: string;
  status: string;
  created_at: string;
  expected_date?: string;
  total_value?: number;
  currency?: string;
}

export default function InventoryReports(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [activeTab, setActiveTab] = useState<"forecast" | "po">("forecast");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({
    lowStock: false,
    limit: 50,
  });
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const loadForecasts = async (page: number = 0, append: boolean = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams({
        endpoint: "variants",
        fields: "id,sku,title,in_stock,replenishment,oos,cost_price,vendor_id",
        limit: String(filters.limit),
        page: String(page),
      });

      if (filters.lowStock) {
        params.set("oos_lt", "7");
      }

      const res = await fetch(`/api/inventory-planner/reports?${params}`);
      const data = await res.json();

      if (data.success && data.data) {
        if (append) {
          setVariants((prev) => [...prev, ...data.data]);
        } else {
          setVariants(data.data);
        }

        // Check if there's more data
        setHasMore(data.data.length === filters.limit);
        setCurrentPage(page);
      }
    } catch (error) {
      console.error("Failed to load forecasts:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadPurchaseOrders = async (
    page: number = 0,
    append: boolean = false
  ) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams({
        endpoint: "purchase-orders",
        limit: String(filters.limit),
        page: String(page),
      });

      const res = await fetch(`/api/inventory-planner/reports?${params}`);
      const data = await res.json();

      if (data.success && data.data) {
        if (append) {
          setPurchaseOrders((prev) => [...prev, ...data.data]);
        } else {
          setPurchaseOrders(data.data);
        }

        setHasMore(data.data.length === filters.limit);
        setCurrentPage(page);
      }
    } catch (error) {
      console.error("Failed to load purchase orders:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleRefresh = () => {
    setCurrentPage(0);
    setHasMore(true);
    if (activeTab === "forecast") {
      loadForecasts(0, false);
    } else {
      loadPurchaseOrders(0, false);
    }
  };

  const loadMoreData = () => {
    const nextPage = currentPage + 1;
    if (activeTab === "forecast") {
      loadForecasts(nextPage, true);
    } else {
      loadPurchaseOrders(nextPage, true);
    }
  };

  const exportToCSV = () => {
    const params = new URLSearchParams({
      endpoint: activeTab === "forecast" ? "variants" : "purchase-orders",
      format: "csv",
      limit: "1000",
    });

    if (activeTab === "forecast" && filters.lowStock) {
      params.set("oos_lt", "7");
    }

    window.open(`/api/inventory-planner/reports?${params}`, "_blank");
  };

  const filteredVariants = variants.filter(
    (v) =>
      !searchTerm ||
      v.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPOs = purchaseOrders.filter(
    (po) =>
      !searchTerm ||
      po.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Inventory Planner Reports</h1>
          <p className="text-gray-600">
            Real-time data from Inventory Planner API
          </p>
        </div>

        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b">
            <div className="flex">
              <button
                onClick={() => {
                  setActiveTab("forecast");
                  setVariants([]);
                  setCurrentPage(0);
                  setHasMore(true);
                }}
                className={`px-6 py-4 font-medium border-b-2 transition ${
                  activeTab === "forecast"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-600 hover:text-gray-800"
                }`}
              >
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Forecast & Replenishment
                </div>
              </button>
              <button
                onClick={() => {
                  setActiveTab("po");
                  setPurchaseOrders([]);
                  setCurrentPage(0);
                  setHasMore(true);
                }}
                className={`px-6 py-4 font-medium border-b-2 transition ${
                  activeTab === "po"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-600 hover:text-gray-800"
                }`}
              >
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  Purchase Orders
                </div>
              </button>
            </div>
          </div>

          <div className="p-6">
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="flex-1 min-w-64">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by SKU, name, or reference..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                {activeTab === "forecast" && (
                  <label className="flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={filters.lowStock}
                      onChange={(e) =>
                        setFilters((f) => ({
                          ...f,
                          lowStock: e.target.checked,
                        }))
                      }
                      className="rounded"
                    />
                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                    <span className="text-sm">Low Stock Only</span>
                  </label>
                )}

                <select
                  value={filters.limit}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, limit: Number(e.target.value) }))
                  }
                  className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value={25}>25 items</option>
                  <option value={50}>50 items</option>
                  <option value={100}>100 items</option>
                  <option value={250}>250 items</option>
                </select>

                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                  />
                  Load Data
                </button>

                <button
                  onClick={exportToCSV}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 text-blue-600 mx-auto mb-4 animate-spin" />
                <p className="text-gray-600">
                  Loading data from Inventory Planner...
                </p>
              </div>
            ) : activeTab === "forecast" ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                          SKU
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                          Product
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">
                          In Stock
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">
                          Replenishment
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">
                          Days to OOS
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">
                          Cost
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredVariants.length > 0 ? (
                        filteredVariants.map((variant) => (
                          <tr key={variant.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium">
                              {variant.sku}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {variant.title || "—"}
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              {variant.in_stock ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-semibold text-blue-600">
                              {variant.replenishment ?? "—"}
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              {variant.oos !== undefined ? (
                                <span
                                  className={
                                    variant.oos < 7
                                      ? "text-red-600 font-medium"
                                      : ""
                                  }
                                >
                                  {variant.oos} days
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              {variant.cost_price
                                ? `$${variant.cost_price.toFixed(2)}`
                                : "—"}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {variant.oos !== undefined && variant.oos < 7 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">
                                  <AlertTriangle className="w-3 h-3" />
                                  Urgent
                                </span>
                              ) : variant.replenishment &&
                                variant.replenishment > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                                  <Package className="w-3 h-3" />
                                  Reorder
                                </span>
                              ) : (
                                <span className="inline-flex px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                                  OK
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-4 py-12 text-center text-gray-500"
                          >
                            {variants.length === 0
                              ? "Click 'Load Data' to fetch forecasts"
                              : "No items match your search"}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {hasMore && variants.length > 0 && (
                  <div className="mt-4 text-center">
                    <button
                      onClick={loadMoreData}
                      disabled={loadingMore}
                      className="px-6 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2 mx-auto"
                    >
                      {loadingMore ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading more...
                        </>
                      ) : (
                        <>Load More</>
                      )}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                          Reference
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                          Vendor
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                          Created
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                          Expected
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">
                          Total Value
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredPOs.length > 0 ? (
                        filteredPOs.map((po) => (
                          <tr key={po.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium">
                              {po.reference}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {po.vendor_name || "—"}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                  po.status === "open"
                                    ? "bg-green-100 text-green-800"
                                    : po.status === "closed"
                                    ? "bg-gray-100 text-gray-600"
                                    : "bg-blue-100 text-blue-800"
                                }`}
                              >
                                {po.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {new Date(po.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {po.expected_date
                                ? new Date(
                                    po.expected_date
                                  ).toLocaleDateString()
                                : "—"}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-semibold">
                              {po.total_value
                                ? `${
                                    po.currency || "$"
                                  }${po.total_value.toLocaleString()}`
                                : "—"}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-4 py-12 text-center text-gray-500"
                          >
                            {purchaseOrders.length === 0
                              ? "Click 'Load Data' to fetch purchase orders"
                              : "No items match your search"}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {hasMore && purchaseOrders.length > 0 && (
                  <div className="mt-4 text-center">
                    <button
                      onClick={loadMoreData}
                      disabled={loadingMore}
                      className="px-6 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2 mx-auto"
                    >
                      {loadingMore ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading more...
                        </>
                      ) : (
                        <>Load More</>
                      )}
                    </button>
                  </div>
                )}
              </>
            )}

            {(filteredVariants.length > 0 || filteredPOs.length > 0) && (
              <div className="mt-4 text-sm text-gray-600 text-center">
                Showing{" "}
                {activeTab === "forecast"
                  ? filteredVariants.length
                  : filteredPOs.length}{" "}
                items
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
