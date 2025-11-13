"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Package,
  PackageCheck,
  Truck,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  PlayCircle,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Types
type TaskType = "PICKING" | "PACKING" | "SHIPPING" | "QC";
type TaskStatus =
  | "PENDING"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "PAUSED"
  | "PARTIALLY_COMPLETED"
  | "COMPLETED"
  | "CANCELLED";

interface WorkTask {
  id: string;
  taskNumber: string;
  type: TaskType;
  status: TaskStatus;
  createdAt: string;
  totalOrders: number;
  completedOrders: number;
  orderNumbers: string[];
  orderIds: string[];
  progress: number;
  priority: number;
  notes: string | null;
  source: "WORK_TASK" | "PICK_LIST" | "PACK_LIST";
}

interface MyWorkResponse {
  tasks: WorkTask[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

export default function MyWorkPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [taskType, setTaskType] = useState<string>("all");
  const [taskStatus, setTaskStatus] = useState<string>("all");

  // Fetch tasks
  const { data, isLoading, error } = useQuery<MyWorkResponse>({
    queryKey: ["my-work", currentPage, taskType, taskStatus],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20",
      });

      if (taskType !== "all") {
        params.append("type", taskType);
      }

      if (taskStatus !== "all") {
        params.append("status", taskStatus);
      }

      const response = await fetch(`/api/users/my-work?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch tasks");
      }
      return response.json();
    },
  });

  const tasks = data?.tasks || [];
  const totalPages = data?.totalPages || 1;

  console.log(tasks);

  // Get stats
  const stats = {
    pending: tasks.filter((t) => t.status === "PENDING").length,
    inProgress: tasks.filter((t) => t.status === "IN_PROGRESS").length,
    completed: tasks.filter((t) => t.status === "COMPLETED").length,
  };

  // Helper functions
  const getTaskIcon = (type: TaskType) => {
    switch (type) {
      case "PICKING":
        return <Package className="w-4 h-4" />;
      case "PACKING":
        return <PackageCheck className="w-4 h-4" />;
      case "SHIPPING":
        return <Truck className="w-4 h-4" />;
      case "QC":
        return <CheckCircle2 className="w-4 h-4" />;
    }
  };

  const getTaskLink = (task: WorkTask) => {
    // If it's a PickList, always go to picking progress page
    if (task.source === "PICK_LIST") {
      return `/dashboard/picking/progress/${task.id}`;
    }

    // If it's a PackList, go to packing progress page
    if (task.source === "PACK_LIST") {
      return `/dashboard/packing/progress/${task.id}`;
    }

    // Otherwise, route based on task type
    switch (task.type) {
      case "PICKING":
        return `/dashboard/picking/${task.id}`;
      case "PACKING":
        // ✅ Go directly to the first order's packing UI
        const firstOrderId = task.orderIds?.[0];
        if (firstOrderId) {
          return `/dashboard/packing/pack/${firstOrderId}`;
        }
        // Fallback to progress view if no orders
        return `/dashboard/packing/progress/${task.id}`;
      case "SHIPPING":
        return `/dashboard/shipping/${task.id}`;
      case "QC":
        return `/dashboard/qc/${task.id}`;
      default:
        return "#";
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case "PENDING":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800/20 dark:text-gray-400";
      case "ASSIGNED":
        return "bg-purple-100 text-purple-800 dark:bg-purple-800/20 dark:text-purple-400";
      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-800 dark:bg-blue-800/20 dark:text-blue-400";
      case "PAUSED":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-800/20 dark:text-yellow-400";
      case "PARTIALLY_COMPLETED":
        return "bg-orange-100 text-orange-800 dark:bg-orange-800/20 dark:text-orange-400";
      case "COMPLETED":
        return "bg-green-100 text-green-800 dark:bg-green-800/20 dark:text-green-400";
      case "CANCELLED":
        return "bg-red-100 text-red-800 dark:bg-red-800/20 dark:text-red-400";
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress === 0) return "bg-gray-200";
    if (progress < 50) return "bg-orange-400 dark:bg-yellow-500";
    if (progress < 100) return "bg-orange-400 dark:bg-orange-500";
    return "bg-blue-400 dark:bg-blue-500";
  };

  return (
    <div className="container mx-auto p-2 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">My Work</h1>
        <p className="text-gray-600 dark:text-gray-400">
          All tasks assigned to you
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Pending
                </p>
                <p className="text-2xl font-bold">{stats.pending}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  In Progress
                </p>
                <p className="text-2xl font-bold">{stats.inProgress}</p>
              </div>
              <PlayCircle className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Completed
                </p>
                <p className="text-2xl font-bold">{stats.completed}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filter Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">
                Task Type
              </label>
              <Select value={taskType} onValueChange={setTaskType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="picking">Picking</SelectItem>
                  <SelectItem value="packing">Packing</SelectItem>
                  <SelectItem value="shipping">Shipping</SelectItem>
                  <SelectItem value="qc">Quality Check</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={taskStatus} onValueChange={setTaskStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="ASSIGNED">Assigned</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="PAUSED">Paused</SelectItem>
                  <SelectItem value="PARTIALLY_COMPLETED">
                    Partially Completed
                  </SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tasks Table */}
      <Card>
        <CardHeader>
          <CardTitle>Your Tasks ({data?.totalCount || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <div className="text-center">
                <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
                <p className="text-gray-600 dark:text-gray-400">
                  Loading tasks...
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600">Failed to load tasks</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">No tasks found</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Task #
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Progress
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Orders
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
                    {tasks.map((task) => (
                      <tr key={task.id}>
                        <td className="px-6 py-4">
                          <span className="text-sm font-mono text-gray-900 dark:text-white">
                            {task.taskNumber}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 dark:text-gray-400">
                            {getTaskIcon(task.type)}
                            <span className="text-sm">{task.type}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                              task.status
                            )}`}
                          >
                            {task.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                          {new Date(task.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="w-full">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-gray-600 dark:text-gray-400">
                                {task.progress}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${getProgressColor(
                                  task.progress
                                )}`}
                                style={{ width: `${task.progress}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {task.completedOrders}/{task.totalOrders}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link href={getTaskLink(task)}>
                            <Button size="sm" variant="outline">
                              {task.status === "COMPLETED"
                                ? "View"
                                : task.status === "IN_PROGRESS" ||
                                  task.status === "PAUSED" ||
                                  task.status === "PARTIALLY_COMPLETED"
                                ? "Continue"
                                : "Start"}
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-4">
                {tasks.map((task) => (
                  <Card key={task.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            {getTaskIcon(task.type)}
                            <span className="font-medium">{task.type}</span>
                          </div>
                          <div className="text-xs font-mono text-gray-500 dark:text-gray-400">
                            {task.taskNumber}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            task.status
                          )}`}
                        >
                          {task.status}
                        </span>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Created:{" "}
                          {new Date(task.createdAt).toLocaleDateString()}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Orders: {task.completedOrders}/{task.totalOrders}
                        </div>

                        {/* Progress */}
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-gray-600 dark:text-gray-400">
                              Progress
                            </span>
                            <span className="font-medium">
                              {task.progress}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${getProgressColor(
                                task.progress
                              )}`}
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <Link href={getTaskLink(task)}>
                        <Button size="sm" variant="outline" className="w-full">
                          {task.status === "COMPLETED"
                            ? "View"
                            : task.status === "IN_PROGRESS" ||
                              task.status === "PAUSED" ||
                              task.status === "PARTIALLY_COMPLETED"
                            ? "Continue"
                            : "Start"}
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Page {currentPage} of {totalPages}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
