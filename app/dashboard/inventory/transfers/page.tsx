"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRightLeft,
  Calendar,
  Filter,
  Package,
  MapPin,
  User,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  Search,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

interface Transfer {
  id: string;
  transactionType: string;
  quantityChange: number;
  referenceType: string;
  notes: string;
  createdAt: string;
  userId: string;
  metadata: {
    status: string;
    fromLocationId: string;
    fromLocationName: string;
    toLocationId: string;
    toLocationName: string;
    quantity: number;
    requestedBy: string;
    requestedByName: string;
    confirmerId: string;
    productName: string;
    approvedBy?: string;
    approvedAt?: string;
    rejectedBy?: string;
    rejectedAt?: string;
  };
  user: {
    id: string;
    name: string;
  };
  productVariant: {
    id: string;
    sku: string;
    name: string;
  };
}

export default function TransferDashboard(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const router = useRouter();

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Fetch transfers
  const { data: transfers, isLoading } = useQuery<Transfer[]>({
    queryKey: ["transfers", statusFilter, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const response = await fetch(
        `/api/inventory/transfers?${params.toString()}`
      );
      if (!response.ok) throw new Error("Failed to fetch transfers");
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Client-side search filter
  const filteredTransfers = transfers?.filter((transfer) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      transfer.metadata.productName?.toLowerCase().includes(query) ||
      transfer.productVariant.sku.toLowerCase().includes(query) ||
      transfer.metadata.fromLocationName?.toLowerCase().includes(query) ||
      transfer.metadata.toLocationName?.toLowerCase().includes(query) ||
      transfer.metadata.requestedByName?.toLowerCase().includes(query)
    );
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500";
      case "APPROVED":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-500";
      case "REJECTED":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Clock className="w-4 h-4" />;
      case "APPROVED":
        return <CheckCircle className="w-4 h-4" />;
      case "REJECTED":
        return <XCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  // Stats
  const stats = {
    total: transfers?.length || 0,
    pending:
      transfers?.filter((t) => t.metadata.status === "PENDING").length || 0,
    approved:
      transfers?.filter((t) => t.metadata.status === "APPROVED").length || 0,
    rejected:
      transfers?.filter((t) => t.metadata.status === "REJECTED").length || 0,
  };

  const exportTransfers = () => {
    if (!filteredTransfers) return;

    const csv = [
      [
        "Date",
        "Product",
        "SKU",
        "From",
        "To",
        "Quantity",
        "Status",
        "Requested By",
        "Notes",
      ],
      ...filteredTransfers.map((t) => [
        new Date(t.createdAt).toLocaleString(),
        t.metadata.productName,
        t.productVariant.sku,
        t.metadata.fromLocationName,
        t.metadata.toLocationName,
        t.metadata.quantity,
        t.metadata.status,
        t.metadata.requestedByName,
        t.notes?.replace(/\n/g, " ") || "",
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transfers-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background p-2">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Transfer Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Monitor and manage inventory transfers
            </p>
          </div>
          {/* <Button onClick={exportTransfers} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button> */}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Total Transfers
                  </p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <ArrowRightLeft className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Pending
                  </p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {stats.pending}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Approved
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    {stats.approved}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Rejected
                  </p>
                  <p className="text-2xl font-bold text-red-400">
                    {stats.rejected}
                  </p>
                </div>
                <XCircle className="w-8 h-8 text-red-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Filter className="w-5 h-5 mr-2" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Status
                </label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      className="cursor-pointer transition hover:bg-gray-100 dark:hover:bg-zinc-800"
                      value="ALL"
                    >
                      All Statuses
                    </SelectItem>
                    <SelectItem
                      className="cursor-pointer transition hover:bg-gray-100 dark:hover:bg-zinc-800"
                      value="PENDING"
                    >
                      Pending
                    </SelectItem>
                    <SelectItem
                      className="cursor-pointer transition hover:bg-gray-100 dark:hover:bg-zinc-800"
                      value="APPROVED"
                    >
                      Approved
                    </SelectItem>
                    <SelectItem
                      className="cursor-pointer transition hover:bg-gray-100 dark:hover:bg-zinc-800"
                      value="REJECTED"
                    >
                      Rejected
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Start Date
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  End Date
                </label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Product, SKU, Location..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {/* Clear Filters */}
            {(statusFilter !== "ALL" ||
              startDate ||
              endDate ||
              searchQuery) && (
              <div className="mt-4">
                <Button
                  className="cursor-pointer"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStatusFilter("ALL");
                    setStartDate("");
                    setEndDate("");
                    setSearchQuery("");
                  }}
                >
                  Clear All Filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transfers List */}
        <Card>
          <CardHeader>
            <CardTitle>
              Transfer History ({filteredTransfers?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : filteredTransfers && filteredTransfers.length > 0 ? (
              <div className="space-y-4">
                {filteredTransfers.map((transfer) => (
                  <div
                    key={transfer.id}
                    className="p-4 border border-gray-200 dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                    onClick={() => {
                      router.push(
                        `/dashboard/inventory/transfers/${transfer.id}`
                      );
                      //   if (transfer.metadata.status === "PENDING") {
                      //     router.push(
                      //       `/dashboard/inventory/transfers/pending/${transfer.id}`
                      //     );
                      //   }
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {/* Product Info */}
                        <div className="flex items-center gap-3 mb-2">
                          <Package className="w-5 h-5 text-gray-400" />
                          <div>
                            <div className="font-semibold">
                              {transfer.metadata.productName}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              SKU: {transfer.productVariant.sku}
                            </div>
                          </div>
                        </div>

                        {/* Transfer Route */}
                        <div className="flex items-center gap-2 mb-2 ml-8">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span className="text-sm">
                            {transfer.metadata.fromLocationName}
                          </span>
                          <ArrowRightLeft className="w-4 h-4 text-blue-500" />
                          <span className="text-sm">
                            {transfer.metadata.toLocationName}
                          </span>
                          <Badge className="bg-blue-100 text-blue-500 dark:bg-blue-900/30 dark:text-blue-500">
                            {transfer.metadata.quantity} units
                          </Badge>
                        </div>

                        {/* Meta Info */}
                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 ml-8">
                          <div className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            {transfer.metadata.requestedByName}
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(transfer.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <Badge
                        className={`${getStatusColor(
                          transfer.metadata.status
                        )} flex items-center gap-1`}
                      >
                        {getStatusIcon(transfer.metadata.status)}
                        {transfer.metadata.status}
                      </Badge>
                    </div>

                    {/* Notes */}
                    {/* {transfer.notes && (
                      <div className="mt-3 ml-8 text-sm text-gray-600 dark:text-gray-400 italic">
                        {transfer.notes.replace("PENDING CONFIRMATION: ", "")}
                      </div>
                    )} */}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <ArrowRightLeft className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No transfers found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
