"use client";

import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  FileText,
  Plus,
  Search,
  Calendar,
  DollarSign,
  Package,
  Loader2,
  Eye,
  Download,
  Edit,
} from "lucide-react";
import { useState } from "react";

interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplier: string;
  status: string;
  orderDate: string;
  expectedDate?: string;
  totalAmount: number;
  items: Array<{
    id: string;
    quantity: number;
    productVariant: {
      sku: string;
      product: {
        name: string;
      };
    };
  }>;
}

export default function PurchaseOrdersPage(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();

  const { data: orders, isLoading } = useQuery<PurchaseOrder[]>({
    queryKey: ["purchase-orders"],
    queryFn: async () => {
      const res = await fetch("/api/purchasing/orders");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const filteredOrders = orders?.filter(
    (order) =>
      order.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.supplier.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const [statusModal, setStatusModal] = useState<{
    open: boolean;
    orderId: string;
    currentStatus: string;
  } | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      orderId,
      status,
    }: {
      orderId: string;
      status: string;
    }) => {
      const res = await fetch(`/api/purchasing/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      setStatusModal(null);
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "DRAFT":
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
      case "PENDING":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "RECEIVED":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "CANCELLED":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Loading purchase orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Purchase Orders</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage and track purchase orders
            </p>
          </div>
          {/* <Button
            onClick={() => router.push("/dashboard/purchasing/orders/create")}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Purchase Order
          </Button> */}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Total Orders
                  </p>
                  <p className="text-2xl font-bold">{orders?.length || 0}</p>
                </div>
                <FileText className="w-8 h-8 text-blue-400 dark:text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Pending
                  </p>
                  <p className="text-2xl font-bold">
                    {orders?.filter((o) => o.status === "PENDING").length || 0}
                  </p>
                </div>
                <Calendar className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Total Value
                  </p>
                  <p className="text-2xl font-bold">
                    $
                    {orders
                      ?.reduce(
                        (sum, o) => sum + parseFloat(o.totalAmount.toString()),
                        0
                      )
                      .toLocaleString() || 0}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Items
                  </p>
                  <p className="text-2xl font-bold">
                    {orders?.reduce((sum, o) => sum + o.items.length, 0) || 0}
                  </p>
                </div>
                <Package className="w-8 h-8 text-blue-400 dark:text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by PO number or supplier..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Orders Table */}
        <Card>
          <CardHeader>
            <CardTitle>Purchase Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredOrders && filteredOrders.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b">
                    <tr className="text-left text-sm text-gray-600 dark:text-gray-400">
                      <th className="pb-3">PO Number</th>
                      <th className="pb-3">Supplier</th>
                      <th className="pb-3">Date</th>
                      <th className="pb-3">Expected</th>
                      <th className="pb-3">Items</th>
                      <th className="pb-3">Total</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="border-b hover:bg-gray-50 dark:hover:bg-zinc-900"
                      >
                        <td className="py-4">
                          <div className="font-medium font-mono">
                            {order.poNumber}
                          </div>
                        </td>
                        <td className="py-4">
                          <div className="font-medium">{order.supplier}</div>
                        </td>
                        <td className="py-4 text-sm text-gray-600 dark:text-gray-400">
                          {new Date(order.orderDate).toLocaleDateString()}
                        </td>
                        <td className="py-4 text-sm text-gray-600 dark:text-gray-400">
                          {order.expectedDate
                            ? new Date(order.expectedDate).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="py-4">
                          <Badge
                            variant="secondary"
                            className="dark:bg-zinc-700 dark:text-zinc-300"
                          >
                            {order.items.length} items
                          </Badge>
                        </td>
                        <td className="py-4 font-semibold">
                          ${parseFloat(order.totalAmount.toString()).toFixed(2)}
                        </td>
                        <td className="py-4">
                          <Badge className={getStatusColor(order.status)}>
                            {order.status}
                          </Badge>
                        </td>
                        <td className="py-4">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                router.push(
                                  `/dashboard/purchasing/orders/${order.id}`
                                )
                              }
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setStatusModal({
                                  open: true,
                                  orderId: order.id,
                                  currentStatus: order.status,
                                })
                              }
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                const res = await fetch(
                                  `/api/purchasing/orders/${order.id}/download`
                                );
                                if (res.ok) {
                                  const blob = await res.blob();
                                  const url = window.URL.createObjectURL(blob);
                                  const a = document.createElement("a");
                                  a.href = url;
                                  a.download = `${order.poNumber}.pdf`;
                                  document.body.appendChild(a);
                                  a.click();
                                  window.URL.revokeObjectURL(url);
                                  document.body.removeChild(a);
                                }
                              }}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">
                  No purchase orders found
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {searchTerm
                    ? "Try adjusting your search"
                    : "Create your first purchase order to get started"}
                </p>
                {!searchTerm && (
                  <Button
                    onClick={() =>
                      router.push("/dashboard/purchasing/orders/create")
                    }
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Purchase Order
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status Update Modal */}
      {statusModal?.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Update Order Status</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Status</label>
              <select
                defaultValue={statusModal.currentStatus}
                onChange={(e) =>
                  setStatusModal({
                    ...statusModal,
                    currentStatus: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:text-gray-400"
              >
                <option value="DRAFT">Draft</option>
                <option value="PENDING">Pending</option>
                <option value="ORDERED">Ordered</option>
                <option value="RECEIVED">Received</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStatusModal(null)}
                className="flex-1"
                disabled={updateStatusMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() =>
                  updateStatusMutation.mutate({
                    orderId: statusModal.orderId,
                    status: statusModal.currentStatus,
                  })
                }
                className="flex-1"
                disabled={updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Status"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
