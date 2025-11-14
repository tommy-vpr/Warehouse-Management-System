// app/dashboard/invoice/page.tsx
// Mobile Responsive Version
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { keepPreviousData } from "@tanstack/react-query";
import InvoiceForm from "@/components/InvoiceForm";
import {
  FileText,
  Download,
  Trash2,
  Eye,
  Search,
  RefreshCw,
  DollarSign,
  Package,
  Loader2,
  AlertCircle,
  Calendar,
  User,
  ArrowLeft,
  Plus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { POListSkeleton } from "@/components/skeleton/POListSkeleton";

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string | null;
  date: string;
  total: string;
  subtotal: string;
  tax: string;
  status: string;
  originalInvoiceUrl: string | null;
  items: any[];
  order?: {
    id: string;
    orderNumber: string;
    status: string;
  } | null;
  createdAt: string;
}

export default function InvoiceDashboardPage(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { data: session } = useSession();
  const { toast } = useToast();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showForm, setShowForm] = useState(false);
  const limit = 20;

  useEffect(() => setMounted(true), []);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["invoices", page, search, statusFilter, refreshTrigger],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: (page + 1).toString(),
        limit: limit.toString(),
      });

      if (search) params.append("search", search);
      if (statusFilter !== "ALL") params.append("status", statusFilter);

      const res = await fetch(`/api/invoice?${params}`);
      if (!res.ok) throw new Error("Failed to fetch invoices");
      return res.json();
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });

  const isFiltering = isFetching && data !== undefined;

  const handleStatusChange = (status: string) => {
    setStatusFilter(status);
    setPage(0);
  };

  const handleDelete = async (id: string, invoiceNumber: string) => {
    if (!confirm(`Delete invoice ${invoiceNumber}? This cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/invoice/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete invoice");

      toast({
        title: "Invoice deleted",
        description: `Invoice ${invoiceNumber} has been deleted.`,
      });

      refetch();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete invoice. Please try again.",
      });
    }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/invoice/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) throw new Error("Failed to update status");

      toast({
        title: "Status updated",
        description: `Invoice status changed to ${status}.`,
      });

      refetch();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update status. Please try again.",
      });
    }
  };

  if (!session?.user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Please sign in to access invoices</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600 dark:text-gray-400">
            Loading invoices...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-600 mb-2">Failed to load invoices</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {error.message}
          </p>
          <Button onClick={() => refetch()} className="cursor-pointer">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const totalPages = data?.pagination?.totalPages || 0;
  const hasNextPage = page < totalPages - 1;
  const hasPrevPage = page > 0;
  const totalInvoices = data?.pagination?.total || 0;
  const paidCount =
    data?.invoices?.filter((inv: Invoice) => inv.status === "PAID").length || 0;
  const totalAmount =
    data?.invoices?.reduce(
      (sum: number, inv: Invoice) => sum + parseFloat(inv.total),
      0
    ) || 0;

  const statusColors = {
    DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
    PENDING:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    PAID: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4 sm:mb-8">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 mb-4 transition"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-sm sm:text-base">Back to Dashboard</span>
          </button>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                  Invoices
                </h1>
              </div>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                Create and manage invoices with barcode generation
              </p>
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  refetch();
                  setRefreshTrigger((prev) => prev + 1);
                }}
                disabled={mounted ? isLoading : false}
                className="cursor-pointer transition"
              >
                <RefreshCw
                  className={`w-4 h-4 ${
                    mounted && (isLoading || isFetching) ? "animate-spin" : ""
                  }`}
                />
                <span className="sm:hidden lg:inline">Refresh</span>
              </Button>
              <Button
                size="sm"
                onClick={() => setShowForm(!showForm)}
                className="cursor-pointer bg-blue-500 hover:bg-blue-600 text-white transition sm:flex-none"
              >
                <Plus className="w-4 h-4" />
                <span>{showForm ? "Hide" : "Create"}</span>
              </Button>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center">
                  <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
                  <div className="ml-2 sm:ml-3">
                    <p className="text-lg sm:text-2xl font-bold">
                      {totalInvoices}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      Total
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center">
                  <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
                  <div className="ml-2 sm:ml-3">
                    <p className="text-lg sm:text-2xl font-bold">
                      ${mounted ? totalAmount.toFixed(2) : totalAmount}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      Amount
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="col-span-2 sm:col-span-1">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center">
                  <Package className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600" />
                  <div className="ml-2 sm:ml-3">
                    <p className="text-lg sm:text-2xl font-bold">{paidCount}</p>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      Paid
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Invoice Form */}
        {showForm && (
          <div className="animate-in slide-in-from-top duration-300 mb-6">
            <InvoiceForm
              userId={session.user.id}
              onSuccess={(invoice) => {
                console.log("Invoice created:", invoice);
                setRefreshTrigger((prev) => prev + 1);
                refetch();
                setShowForm(false);
                toast({
                  title: "Success!",
                  description: `Invoice ${invoice.invoiceNumber} created successfully`,
                });
              }}
            />
          </div>
        )}

        {/* Divider */}
        {showForm && (
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-background text-gray-500 font-medium">
                All Invoices
              </span>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col gap-2 sm:gap-4 mb-4 sm:mb-6 text-xs sm:text-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search invoice #, customer..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className="pl-10 dark:border-zinc-700 text-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:text-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {/* Invoice List */}
        {isFiltering ? (
          <POListSkeleton />
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {data?.invoices && data.invoices.length === 0 && (
              <Card>
                <CardContent className="p-8 sm:p-12 text-center">
                  <FileText className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No invoices found
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {search
                      ? "No invoices match your search"
                      : "Create your first invoice to get started"}
                  </p>
                  {!showForm && (
                    <Button
                      onClick={() => setShowForm(true)}
                      className="cursor-pointer"
                      variant="outline"
                    >
                      Create Invoice
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {data?.invoices?.map((invoice: Invoice) => (
              <Card
                key={invoice.id}
                className="hover:shadow-lg transition-shadow"
              >
                <CardContent className="p-4 sm:p-6">
                  {/* Desktop Layout */}
                  <div className="hidden lg:flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center flex-wrap gap-x-6 gap-y-3">
                        {/* Invoice Number */}
                        <div className="flex items-center gap-2">
                          <FileText className="w-5 h-5 text-blue-600" />
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {invoice.invoiceNumber}
                          </h3>
                        </div>

                        {/* Status Dropdown */}
                        <select
                          value={invoice.status}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleStatusUpdate(invoice.id, e.target.value);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className={`px-3 py-1 rounded-full text-xs font-medium border-0 cursor-pointer ${
                            statusColors[
                              invoice.status as keyof typeof statusColors
                            ]
                          }`}
                        >
                          <option value="DRAFT">Draft</option>
                          <option value="PENDING">Pending</option>
                          <option value="PAID">Paid</option>
                          <option value="CANCELLED">Cancelled</option>
                        </select>

                        {/* Date */}
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {mounted
                              ? new Date(invoice.date).toLocaleDateString()
                              : invoice.date}
                          </span>
                        </div>

                        {/* Total */}
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">
                          ${invoice.total}
                        </div>

                        {/* Items Count */}
                        <Badge variant="outline" className="text-xs">
                          <Package className="w-3 h-3 mr-1" />
                          {invoice.items.length} item
                          {invoice.items.length !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/dashboard/invoice/${invoice.id}`);
                        }}
                        className="cursor-pointer"
                      >
                        View Invoice
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(
                            `/api/invoice/${invoice.id}/pdf`,
                            "_blank"
                          );
                        }}
                        className="cursor-pointer"
                        title="Download PDF"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(invoice.id, invoice.invoiceNumber);
                        }}
                        className="cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </Button>
                    </div>
                  </div>

                  {/* Mobile Layout */}
                  <div className="lg:hidden space-y-3">
                    {/* Header Row */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                          {invoice.invoiceNumber}
                        </h3>
                      </div>
                      <Badge
                        className={`text-[10px] ${
                          statusColors[
                            invoice.status as keyof typeof statusColors
                          ]
                        }`}
                      >
                        {invoice.status}
                      </Badge>
                    </div>

                    {/* Customer Info */}
                    <div className="text-sm">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {invoice.customerName}
                      </p>
                      {invoice.customerEmail && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {invoice.customerEmail}
                        </p>
                      )}
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">Date</p>
                        <p className="font-medium">
                          {mounted
                            ? new Date(invoice.date).toLocaleDateString()
                            : invoice.date}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">
                          Total
                        </p>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          ${invoice.total}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">
                          Items
                        </p>
                        <p className="font-medium">
                          {invoice.items.length} item
                          {invoice.items.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">
                          Status
                        </p>
                        <select
                          value={invoice.status}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleStatusUpdate(invoice.id, e.target.value);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 dark:bg-zinc-800 dark:text-gray-300 cursor-pointer"
                        >
                          <option value="DRAFT">Draft</option>
                          <option value="PENDING">Pending</option>
                          <option value="PAID">Paid</option>
                          <option value="CANCELLED">Cancelled</option>
                        </select>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-2 pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/dashboard/invoice/${invoice.id}`);
                        }}
                        className="w-full cursor-pointer"
                      >
                        View Invoice
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(
                              `/api/invoice/${invoice.id}/pdf`,
                              "_blank"
                            );
                          }}
                          className="flex-1 cursor-pointer"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          PDF
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(invoice.id, invoice.invoiceNumber);
                          }}
                          className="flex-1 cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="w-4 h-4 mr-2 text-red-400" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && !isFiltering && (
          <div className="flex flex-col sm:flex-row items-center justify-between py-3 mt-4 gap-3">
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              Page {page + 1} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                disabled={!hasPrevPage || isFiltering}
                className="cursor-pointer"
              >
                Previous
              </Button>

              {/* Page numbers - hide on very small screens */}
              <div className="hidden sm:flex gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum =
                    page <= 2
                      ? i
                      : page >= totalPages - 3
                      ? totalPages - 5 + i
                      : page - 2 + i;

                  if (pageNum < 0 || pageNum >= totalPages) return null;

                  return (
                    <Button
                      key={pageNum}
                      variant={page === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPage(pageNum)}
                      className="w-10 cursor-pointer"
                      disabled={isFiltering}
                    >
                      {pageNum + 1}
                    </Button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPage((prev) => Math.min(totalPages - 1, prev + 1))
                }
                disabled={!hasNextPage || isFiltering}
                className="cursor-pointer"
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
