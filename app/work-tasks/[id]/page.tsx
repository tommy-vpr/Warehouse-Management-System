// app/dashboard/work-tasks/[id]/page.tsx
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  PlayCircle,
} from "lucide-react";

export default function WorkTaskDetailPage(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = useParams();
  const taskId = params.id as string;
  const queryClient = useQueryClient();

  // Fetch task details
  const { data, isLoading, error } = useQuery({
    queryKey: ["work-task", taskId],
    queryFn: async () => {
      const res = await fetch(`/api/work-tasks/${taskId}`);
      if (!res.ok) throw new Error("Failed to fetch task");
      return res.json();
    },
  });

  // Complete item mutation
  const completeItemMutation = useMutation({
    mutationFn: async ({
      taskItemId,
      quantityCompleted,
    }: {
      taskItemId: string;
      quantityCompleted?: number;
    }) => {
      const res = await fetch(`/api/work-tasks/${taskId}/complete-item`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskItemId, quantityCompleted }),
      });
      if (!res.ok) throw new Error("Failed to complete item");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["my-work"] });
    },
  });

  // ✅ FIX: Check loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  // ✅ FIX: Check error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">Failed to load task</p>
          <p className="text-sm text-gray-600 mt-2">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      </div>
    );
  }

  // ✅ FIX: Check if data exists before destructuring
  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No data available</p>
        </div>
      </div>
    );
  }

  // ✅ NOW it's safe to destructure
  const { task, stats, itemsByOrder } = data;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-800";
      case "PENDING":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">{task.taskNumber}</h1>
            <div className="flex items-center gap-3">
              <Badge className={getStatusColor(task.status)}>
                {task.status}
              </Badge>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {task.type} Task
              </span>
              {task.assignedTo && (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Assigned to: {task.assignedTo.name || task.assignedTo.email}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Orders
                </p>
                <p className="text-2xl font-bold">
                  {stats.completedOrders}/{stats.totalOrders}
                </p>
              </div>
              <Package className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Items
                </p>
                <p className="text-2xl font-bold">
                  {stats.completedItems}/{stats.totalItems}
                </p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Progress
                </p>
                <p className="text-2xl font-bold">{stats.orderProgress}%</p>
              </div>
              <Clock className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Status
                </p>
                <p className="text-lg font-bold">{task.status}</p>
              </div>
              {task.status === "COMPLETED" ? (
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              ) : (
                <PlayCircle className="w-8 h-8 text-blue-500" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders and Items */}
      <Card>
        <CardHeader>
          <CardTitle>Orders & Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {itemsByOrder && itemsByOrder.length > 0 ? (
              itemsByOrder.map((orderGroup: any) => {
                const allItemsComplete = orderGroup.items.every(
                  (item: any) => item.status === "COMPLETED"
                );

                return (
                  <div
                    key={orderGroup.order.id}
                    className="border rounded-lg p-4"
                  >
                    {/* Order Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-bold text-lg">
                          Order #{orderGroup.order.orderNumber}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {orderGroup.order.customerName}
                        </p>
                      </div>
                      {allItemsComplete && (
                        <Badge className="bg-green-100 text-green-800">
                          Complete
                        </Badge>
                      )}
                    </div>

                    {/* Items List */}
                    <div className="space-y-3">
                      {orderGroup.items.map((item: any) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded"
                        >
                          <div className="flex-1">
                            <div className="font-medium">
                              {item.productVariant?.product?.name ||
                                item.productVariant?.name ||
                                "Unknown Product"}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              SKU: {item.productVariant?.sku || "N/A"}
                              {item.location &&
                                ` • Location: ${item.location.name}`}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              Quantity: {item.quantityCompleted || 0}/
                              {item.quantityRequired}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {item.status === "COMPLETED" ? (
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                            ) : (
                              <Button
                                size="sm"
                                onClick={() =>
                                  completeItemMutation.mutate({
                                    taskItemId: item.id,
                                  })
                                }
                                disabled={
                                  completeItemMutation.isPending ||
                                  task.status === "COMPLETED"
                                }
                              >
                                {completeItemMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  "Complete"
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-500">
                No items found for this task
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
