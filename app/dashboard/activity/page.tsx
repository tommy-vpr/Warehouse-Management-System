"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Search,
  DollarSign,
  Download,
  Loader2,
  Package,
  ShoppingCart,
  Truck,
  Scan,
  Bell,
  RefreshCw,
  User,
  Clock,
  ArrowLeftRight,
  Settings,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ActivityDetailModal from "@/components/modal/ActivityDetailModal"; // ← Add this import

import { getActivityBadgeColor, getActivityIcon } from "@/lib/activity-utils";

interface Activity {
  id: string;
  type: string;
  message: string;
  time: string;
  userName?: string;
  userId?: string;
  details?: any;
  createdAt: string;
}

interface FetchActivitiesParams {
  type: string;
  limit: number;
  pageParam: number;
}

const fetchActivities = async ({
  type,
  limit,
  pageParam,
}: FetchActivitiesParams): Promise<Activity[]> => {
  const params = new URLSearchParams({
    limit: String(limit),
    page: String(pageParam),
  });

  if (type !== "all") {
    params.set("type", type);
  }

  const res = await fetch(`/api/dashboard/activity?${params}`);
  const data = await res.json();

  if (!Array.isArray(data)) {
    return [];
  }

  return data;
};

export default function ActivityPage(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(
    null
  ); // ← Add this
  const [isModalOpen, setIsModalOpen] = useState(false); // ← Add this
  const [filters, setFilters] = useState({
    type: "all",
    limit: 50,
  });

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["activities", filters.type, filters.limit],
    queryFn: ({ pageParam = 0 }) => fetchActivities({ ...filters, pageParam }),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < filters.limit) {
        return undefined;
      }
      return allPages.length;
    },
    initialPageParam: 0,
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
  });

  const activities = useMemo(() => {
    return data?.pages.flatMap((page) => page) ?? [];
  }, [data]);

  const filteredActivities = useMemo(() => {
    if (!searchTerm) return activities;
    const search = searchTerm.toLowerCase();
    return activities.filter(
      (activity) =>
        activity.message.toLowerCase().includes(search) ||
        activity.userName?.toLowerCase().includes(search) ||
        activity.type.toLowerCase().includes(search)
    );
  }, [activities, searchTerm]);

  const handleFilterChange = (key: string, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // ← Add this handler
  const handleActivityClick = (activity: Activity) => {
    setSelectedActivity(activity);
    setIsModalOpen(true);
  };

  const getTransactionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      receipt: "Receipt",
      sale: "Sale",
      order: "Order",
      scan: "Scan/Count",
      shipment: "Shipment",
    };
    return labels[type.toLowerCase()] || type.toUpperCase();
  };

  const exportCSV = () => {
    const params = new URLSearchParams({
      format: "csv",
      limit: "1000",
    });
    if (filters.type !== "all") {
      params.set("type", filters.type);
    }
    window.open(`/api/dashboard/activity?${params}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="cursor-pointer flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold mb-2 text-foreground">
            Activity Log
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            View all warehouse operations and system activities
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-card rounded-lg shadow dark:shadow-lg p-6 mb-6 border dark:border-border">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  placeholder="Search activities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border dark:border-border rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 bg-white dark:bg-background text-foreground placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <select
                value={filters.type}
                onChange={(e) => handleFilterChange("type", e.target.value)}
                className="text-sm px-4 py-2 border dark:border-border rounded-lg bg-white dark:bg-background text-foreground"
              >
                <option value="all">All Types</option>
                <optgroup label="Receiving">
                  <option value="PO_RECEIVING">PO Receiving</option>
                  <option value="ASN_RECEIVING">ASN Receiving</option>
                  <option value="TRANSFER_RECEIVING">Transfer Receiving</option>
                  <option value="RETURNS">Returns</option>
                </optgroup>
                <optgroup label="Inventory">
                  <option value="ADJUSTMENT">Adjustment</option>
                  <option value="COUNT">Count</option>
                </optgroup>
                <optgroup label="Orders">
                  <option value="ALLOCATION">Allocation</option>
                  <option value="DEALLOCATION">Deallocation</option>
                  <option value="SALE">Sale</option>
                </optgroup>
                <optgroup label="Transfers">
                  <option value="TRANSFER">Transfer</option>
                </optgroup>
                <optgroup label="Legacy">
                  <option value="RECEIPT">Receipt</option>
                </optgroup>
              </select>

              <select
                value={filters.limit}
                onChange={(e) =>
                  handleFilterChange("limit", Number(e.target.value))
                }
                className="text-sm px-4 py-2 border dark:border-border rounded-lg bg-white dark:bg-background text-foreground"
              >
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>

              <Button
                variant="outline"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>

              <Button variant="outline" onClick={exportCSV}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>

        {/* Activity List */}
        {isLoading ? (
          <div className="bg-white dark:bg-card rounded-lg shadow dark:shadow-lg p-12 text-center border dark:border-border">
            <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto mb-4 animate-spin" />
            <p className="text-gray-600 dark:text-gray-400">
              Loading activities...
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-card rounded-lg shadow dark:shadow-lg border dark:border-border">
            <div className="p-6 border-b dark:border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">
                  Recent Activities
                </h2>
                <Badge variant="outline">{filteredActivities.length}</Badge>
              </div>
            </div>

            <div className="divide-y dark:divide-border">
              {filteredActivities.length > 0 ? (
                filteredActivities.map((activity) => (
                  <div
                    key={activity.id}
                    onClick={() => handleActivityClick(activity)} // ← Add onClick handler
                    className="p-6 hover:bg-gray-50 dark:hover:bg-accent transition-colors cursor-pointer"
                  >
                    <div className="flex items-start gap-4">
                      <div>{getActivityIcon(activity.type, 5)}</div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <p className="text-sm font-medium text-foreground">
                            {activity.message}
                          </p>
                          <Badge
                            className={`${getActivityBadgeColor(
                              activity.type
                            )} text-xs rounded-4xl px-3 py-1 whitespace-nowrap`}
                          >
                            {getTransactionTypeLabel(activity.type)}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{activity.time}</span>
                          </div>

                          {activity.userName && (
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              <span className="text-blue-500 dark:text-blue-400">
                                {activity.userName}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                  <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                  <p className="text-sm">No activities found</p>
                </div>
              )}
            </div>

            {/* Load More Button */}
            {hasNextPage && (
              <div className="p-4 border-t dark:border-border text-center">
                <Button
                  variant="outline"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="w-full sm:w-auto"
                >
                  {isFetchingNextPage ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading more...
                    </>
                  ) : (
                    "Load More"
                  )}
                </Button>
              </div>
            )}

            {/* Footer */}
            {filteredActivities.length > 0 && (
              <div className="px-6 py-3 bg-gray-50 dark:bg-muted border-t dark:border-border text-sm text-gray-600 dark:text-gray-400 text-center">
                Showing {filteredActivities.length} activities
                {!hasNextPage && activities.length > 0 && " (all loaded)"}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ← Add the Modal component at the bottom */}
      <ActivityDetailModal
        activity={selectedActivity}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
