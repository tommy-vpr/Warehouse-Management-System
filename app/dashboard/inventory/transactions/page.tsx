"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Plus,
  Minus,
  Edit,
  ArrowRightLeft,
  Archive,
  History,
  Loader2,
  Download,
  Filter,
} from "lucide-react";
import { useState } from "react";

import { getActivityBadgeColor, getActivityIcon } from "@/lib/activity-utils";

interface Transaction {
  id: string;
  productVariantId: string;
  productName: string;
  sku: string;
  locationName?: string;
  transactionType: string; // Changed from 'type'
  quantityChange: number;
  referenceId?: string;
  referenceType?: string;
  userName?: string;
  notes?: string;
  createdAt: string;
}

interface TransactionsResponse {
  transactions: Transaction[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export default function TransactionsPage(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productId = searchParams.get("product");
  const typeParam = searchParams.get("type");

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");

  // const { data, isLoading } = useQuery<TransactionsResponse>({
  //   queryKey: ["transactions", productId],
  //   queryFn: async () => {
  //     const url = productId
  //       ? `/api/inventory/transactions?product=${productId}`
  //       : "/api/inventory/transactions";
  //     const res = await fetch(url);
  //     if (!res.ok) throw new Error("Failed to fetch");
  //     return res.json();
  //   },
  // });

  const { data, isLoading } = useQuery<TransactionsResponse>({
    queryKey: ["transactions", productId, typeParam], // Include in cache key
    queryFn: async () => {
      const params = new URLSearchParams();
      if (productId) params.append("product", productId);
      if (typeParam) params.append("type", typeParam); // Add this

      const url = `/api/inventory/transactions${
        params.toString() ? `?${params.toString()}` : ""
      }`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const transactions = data?.transactions || [];

  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch =
      t.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType =
      typeFilter === "ALL" || t.transactionType === typeFilter;
    return matchesSearch && matchesType;
  });

  // const getTransactionIcon = (type: string) => {
  //   switch (type) {
  //     case "RECEIPT":
  //       return <Plus className="w-4 h-4 text-green-600" />;
  //     case "SALE":
  //       return <Minus className="w-4 h-4 text-red-600" />;
  //     case "ADJUSTMENT":
  //       return <Edit className="w-4 h-4 text-blue-600" />;
  //     case "TRANSFER":
  //       return <ArrowRightLeft className="w-4 h-4 text-teal-600" />;
  //     case "COUNT":
  //       return <Archive className="w-4 h-4 text-orange-600" />;
  //     default:
  //       return <History className="w-4 h-4 text-gray-600" />;
  //   }
  // };

  // const getTransactionBadgeColor = (type: string) => {
  //   switch (type) {
  //     case "RECEIPT":
  //       return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  //     case "SALE":
  //       return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  //     case "ADJUSTMENT":
  //       return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
  //     case "TRANSFER":
  //       return "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200";
  //     case "COUNT":
  //       return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
  //     default:
  //       return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  //   }
  // };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Loading transactions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className="mr-4"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">
                {productId ? "Product Transactions" : "All Transactions"}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                {data?.pagination.total || 0} transactions
              </p>
            </div>
          </div>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search by product name or SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border dark:border-border rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 bg-white dark:bg-background text-foreground placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
              </div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="text-sm px-4 py-2 border dark:border-border rounded-lg bg-white dark:bg-background text-foreground"
              >
                <option value="ALL">All Types</option>
                <option value="RECEIPT">Receipt</option>
                <option value="SALE">Sale</option>
                <option value="ADJUSTMENT">Adjustment</option>
                <option value="TRANSFER">Transfer</option>
                <option value="COUNT">Count</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredTransactions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b">
                    <tr className="text-left text-sm text-gray-600 dark:text-gray-400">
                      <th className="pb-3">Date & Time</th>
                      {!productId && <th className="pb-3">Product</th>}
                      <th className="pb-3">Type</th>
                      <th className="pb-3">Location</th>
                      <th className="pb-3 text-right">Quantity</th>
                      <th className="pb-3">Reference</th>
                      <th className="pb-3">User</th>
                      <th className="pb-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((transaction) => (
                      <tr
                        key={transaction.id}
                        className="border-b hover:bg-gray-50 dark:hover:bg-zinc-900"
                      >
                        <td className="py-4 text-sm">
                          {new Date(transaction.createdAt).toLocaleString()}
                        </td>
                        {!productId && (
                          <td className="py-4">
                            <div className="font-medium">
                              {transaction.productName}
                            </div>
                            <div className="text-xs text-gray-500">
                              {transaction.sku}
                            </div>
                          </td>
                        )}
                        <td className="py-4">
                          <div className="flex items-center gap-2">
                            {getActivityIcon(transaction.transactionType)}
                            <Badge
                              className={getActivityBadgeColor(
                                transaction.transactionType
                              )}
                            >
                              {transaction.transactionType}
                            </Badge>
                          </div>
                        </td>
                        <td className="py-4 text-sm">
                          {transaction.locationName || "—"}
                        </td>
                        <td className="py-4 text-right">
                          <span
                            className={`font-semibold ${
                              transaction.quantityChange > 0
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {transaction.quantityChange > 0 ? "+" : ""}
                            {transaction.quantityChange}
                          </span>
                        </td>
                        <td className="py-4 text-sm">
                          {transaction.referenceType && (
                            <Badge variant="outline">
                              {transaction.referenceType}
                            </Badge>
                          )}
                        </td>
                        <td className="py-4 text-sm">
                          {transaction.userName || "System"}
                        </td>
                        <td className="py-4 text-sm max-w-xs truncate">
                          {transaction.notes || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <History className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium mb-2">
                  No transactions found
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {searchTerm || typeFilter !== "ALL"
                    ? "Try adjusting your filters"
                    : "No transactions recorded yet"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
