"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Calendar,
  Package,
  TrendingUp,
  AlertTriangle,
  Clock,
  Eye,
  Play,
  Pause,
  Archive,
  CheckCircle,
  Trash2,
  Edit,
  Copy,
  FileText,
  Loader2,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/hooks/use-toast";

interface CycleCountCampaign {
  id: string;
  name: string;
  description?: string;
  countType: string;
  status: "PLANNED" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
  startDate: string;
  endDate?: string;
  totalTasks: number;
  completedTasks: number;
  variancesFound: number;
  accuracy?: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  assignedTo: string[];
  hasPendingReviews?: boolean;
}

interface DashboardStats {
  totalCampaigns: number;
  activeCampaigns: number;
  completedThisWeek: number;
  averageAccuracy: number;
  totalVariances: number;
  pendingReviews: number;
  tasksCompletedThisMonth: number;
  totalTasksThisMonth: number;
}

interface FetchCampaignsParams {
  limit: number;
  pageParam: number;
  search?: string;
  status?: string;
  type?: string;
  productVariantId?: string;
}

const fetchCampaigns = async ({
  limit,
  pageParam,
  search,
  status,
  type,
  productVariantId,
}: FetchCampaignsParams): Promise<{
  campaigns: CycleCountCampaign[];
  stats: DashboardStats;
  total: number;
}> => {
  const params = new URLSearchParams({
    limit: String(limit),
    page: String(pageParam),
  });

  if (search) params.append("search", search);
  if (status && status !== "ALL") params.append("status", status);
  if (type && type !== "ALL") params.append("type", type);
  if (productVariantId) params.append("productVariantId", productVariantId);

  const res = await fetch(`/api/inventory/cycle-counts/campaigns?${params}`);
  if (!res.ok) throw new Error("Failed to fetch campaigns");

  const data = await res.json();
  return {
    campaigns: data.campaigns,
    stats: data.stats,
    total: data.campaigns.length, // You'll need to add actual total from backend
  };
};

export default function CycleCountDashboard(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const productVariantId = searchParams.get("product");

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Infinite query for campaigns
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useInfiniteQuery({
      queryKey: [
        "cycle-count-campaigns-infinite",
        productVariantId,
        searchTerm,
        statusFilter,
        typeFilter,
      ],
      queryFn: ({ pageParam = 0 }) =>
        fetchCampaigns({
          limit: 10,
          pageParam,
          search: searchTerm,
          status: statusFilter,
          type: typeFilter,
          productVariantId: productVariantId || undefined,
        }),
      getNextPageParam: (lastPage, allPages) => {
        const totalLoaded = allPages.reduce(
          (sum, page) => sum + page.campaigns.length,
          0
        );
        // You'll need to return actual total from backend
        // For now, just check if we got a full page
        if (lastPage.campaigns.length < 10) {
          return undefined;
        }
        return allPages.length;
      },
      initialPageParam: 0,
      staleTime: 30 * 1000,
    });

  const campaigns = useMemo(() => {
    return data?.pages.flatMap((page) => page.campaigns) ?? [];
  }, [data]);

  const stats = data?.pages[0]?.stats || {
    totalCampaigns: 0,
    activeCampaigns: 0,
    completedThisWeek: 0,
    averageAccuracy: 0,
    totalVariances: 0,
    pendingReviews: 0,
    tasksCompletedThisMonth: 0,
    totalTasksThisMonth: 0,
  };

  // Update campaign status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({
      campaignId,
      status,
    }: {
      campaignId: string;
      status: string;
    }) => {
      const response = await fetch(
        `/api/inventory/cycle-counts/campaigns/${campaignId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update campaign");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["cycle-count-campaigns-infinite"],
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const response = await fetch(
        `/api/inventory/cycle-counts/campaigns/${campaignId}`,
        {
          method: "DELETE",
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete campaign");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["cycle-count-campaigns-infinite"],
      });
      toast({
        title: "Campaign Deleted",
        description: "The campaign has been successfully deleted.",
        variant: "success",
      });
      setDeleteDialogOpen(false);
      setCampaignToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDeleteClick = (campaign: CycleCountCampaign) => {
    setCampaignToDelete({ id: campaign.id, name: campaign.name });
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (campaignToDelete) {
      deleteMutation.mutate(campaignToDelete.id);
    }
  };

  const handleStartCampaign = (campaignId: string, campaignName: string) => {
    toast({
      title: "⚠️ Confirm Action",
      description: (
        <div className="space-y-3">
          <p className="text-base font-medium">
            Are you sure you want to start campaign:
          </p>
          <p className="text-lg font-bold text-foreground">"{campaignName}"?</p>
          <p className="text-sm text-muted-foreground">
            This will make the campaign active and ready for counting.
          </p>
        </div>
      ),
      action: (
        <Button
          variant="default"
          size="lg"
          className="bg-green-600 hover:bg-green-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 px-6"
          onClick={() => {
            updateStatusMutation.mutate(
              { campaignId, status: "ACTIVE" },
              {
                onSuccess: () => {
                  toast({
                    title: "✅ Campaign Started",
                    description: `${campaignName} is now active and ready for counting.`,
                    variant: "success",
                  });
                },
                onError: (error) => {
                  toast({
                    title: "❌ Error",
                    description: error.message,
                    variant: "destructive",
                  });
                },
              }
            );
          }}
        >
          ✓ Yes, Start Campaign
        </Button>
      ),
      duration: 10000,
    });
  };

  const handlePauseCampaign = (campaignId: string, campaignName: string) => {
    const confirmed = window.confirm(
      `Pause campaign "${campaignName}"? In-progress tasks will be paused and can be resumed later.`
    );

    if (!confirmed) return;

    updateStatusMutation.mutate(
      { campaignId, status: "PAUSED" },
      {
        onSuccess: () => {
          toast({
            title: "Campaign Paused",
            description: `${campaignName} has been paused. You can resume it later.`,
            variant: "warning",
          });
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PLANNED":
        return "bg-blue-100 text-blue-800 dark:bg-blue-600 dark:text-blue-100";
      case "ACTIVE":
        return "bg-amber-100 text-amber-800 dark:bg-amber-600 dark:text-amber-100";
      case "COMPLETED":
        return "bg-green-100 text-green-800 dark:bg-green-600 dark:text-green-100";
      case "PAUSED":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-600 dark:text-yellow-100";
      case "CANCELLED":
        return "bg-red-100 text-red-800 dark:bg-red-600 dark:text-red-100";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-100";
    }
  };

  const getCountTypeLabel = (countType: string) => {
    return countType
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesNeedsReview =
      statusFilter === "NEEDS_REVIEW"
        ? campaign.hasPendingReviews === true
        : true;

    return matchesNeedsReview;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600 dark:text-gray-200">
            Loading campaigns...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Cycle Count Campaigns
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage inventory cycle counting campaigns and tasks
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => {
                const createUrl = productVariantId
                  ? `/dashboard/inventory/count/create?product=${productVariantId}`
                  : `/dashboard/inventory/count/create`;
                router.push(createUrl);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Campaign
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-200">
                    Total Campaigns
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-200">
                    {stats.totalCampaigns}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-600 rounded-full">
                  <Archive className="w-6 h-6 text-blue-600 dark:text-blue-100" />
                </div>
              </div>
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-200">
                All time campaigns
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-200">
                    Active Campaigns
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    {stats.activeCampaigns}
                  </p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-600 rounded-full">
                  <Clock className="w-6 h-6 text-green-600 dark:text-green-100" />
                </div>
              </div>
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-200">
                Currently running
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-200">
                    Average Accuracy
                  </p>
                  <p className="text-2xl font-bold text-blue-600">
                    {stats.averageAccuracy.toFixed(1)}%
                  </p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-600 rounded-full">
                  <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-100" />
                </div>
              </div>
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-200">
                Last 30 days
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-200">
                    Pending Reviews
                  </p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {stats.pendingReviews}
                  </p>
                </div>
                <div className="p-3 bg-yellow-100 dark:bg-yellow-600 rounded-full">
                  <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-100" />
                </div>
              </div>
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-200">
                Requiring attention
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Additional Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-200">
                    Completed This Week
                  </p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-200">
                    {stats.completedThisWeek}
                  </p>
                </div>
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-200">
                    Tasks This Month
                  </p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-200">
                    {stats.tasksCompletedThisMonth}/{stats.totalTasksThisMonth}
                  </p>
                </div>
                <Package className="w-5 h-5 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-200">
                    Total Variances
                  </p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-200">
                    {stats.totalVariances}
                  </p>
                </div>
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search campaigns..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 dark:border-zinc-600"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs px-3 py-2 border border-gray-300 dark:border-zinc-700 dark:text-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="PLANNED">Planned</option>
                <option value="ACTIVE">Active</option>
                <option value="COMPLETED">Completed</option>
                <option value="PAUSED">Paused</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="NEEDS_REVIEW">Needs Review</option>
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="text-xs px-3 py-2 border border-gray-300 dark:border-zinc-700 dark:text-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Types</option>
                <option value="FULL">Full Count</option>
                <option value="PARTIAL">Partial Count</option>
                <option value="ABC_ANALYSIS">ABC Analysis</option>
                <option value="FAST_MOVING">Fast Moving</option>
                <option value="SLOW_MOVING">Slow Moving</option>
                <option value="NEGATIVE_STOCK">Negative Stock</option>
                <option value="ZERO_STOCK">Zero Stock</option>
                <option value="HIGH_VALUE">High Value</option>
              </select>
            </div>
            {stats.pendingReviews > 0 && (
              <div className="mt-4 flex gap-2">
                <Button
                  variant={
                    statusFilter === "NEEDS_REVIEW" ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => {
                    if (statusFilter === "NEEDS_REVIEW") {
                      setStatusFilter("ALL");
                    } else {
                      setStatusFilter("NEEDS_REVIEW");
                    }
                  }}
                >
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  Needs Review ({stats.pendingReviews})
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Campaigns List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Campaigns ({filteredCampaigns.length})</span>
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                More Filters
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filteredCampaigns.length === 0 ? (
              <div className="text-center py-12 px-6">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No campaigns found</p>
                <Button
                  className="mt-4"
                  onClick={() => {
                    const createUrl = productVariantId
                      ? `/dashboard/inventory/count/create?product=${productVariantId}`
                      : `/dashboard/inventory/count/create`;
                    router.push(createUrl);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Campaign
                </Button>
              </div>
            ) : (
              <>
                <div className="divide-y dark:divide-border">
                  {filteredCampaigns.map((campaign) => (
                    <div
                      key={campaign.id}
                      className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-200">
                              {campaign.name}
                            </h3>
                            <Badge className={getStatusColor(campaign.status)}>
                              {campaign.status}
                            </Badge>
                            <Badge variant="outline">
                              {getCountTypeLabel(campaign.countType)}
                            </Badge>
                          </div>

                          {campaign.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                              {campaign.description}
                            </p>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm text-gray-600 dark:text-gray-400">
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-1" />
                              <span>
                                {campaign.status === "PLANNED"
                                  ? `Starts: ${new Date(
                                      campaign.startDate
                                    ).toLocaleDateString()}`
                                  : campaign.status === "ACTIVE"
                                  ? `Started: ${new Date(
                                      campaign.startDate
                                    ).toLocaleDateString()}`
                                  : campaign.endDate
                                  ? `Completed: ${new Date(
                                      campaign.endDate
                                    ).toLocaleDateString()}`
                                  : `Started: ${new Date(
                                      campaign.startDate
                                    ).toLocaleDateString()}`}
                              </span>
                            </div>

                            <div className="flex items-center">
                              <Package className="w-4 h-4 mr-1" />
                              <span>
                                {campaign.completedTasks}/{campaign.totalTasks}{" "}
                                tasks
                              </span>
                            </div>

                            <div className="flex items-center">
                              <TrendingUp className="w-4 h-4 mr-1" />
                              <span>
                                {campaign.accuracy?.toFixed(1) ?? "0.0"}%
                                accuracy
                              </span>
                            </div>

                            {campaign.variancesFound > 0 && (
                              <div className="flex items-center text-red-400">
                                <AlertTriangle className="w-4 h-4 mr-1" />
                                <span>{campaign.variancesFound} variances</span>
                              </div>
                            )}
                          </div>

                          {campaign.status === "ACTIVE" &&
                            campaign.totalTasks > 0 && (
                              <div className="mt-3">
                                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-500 mb-1">
                                  <span>Progress</span>
                                  <span>
                                    {Math.round(
                                      (campaign.completedTasks /
                                        campaign.totalTasks) *
                                        100
                                    )}
                                    %
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{
                                      width: `${
                                        (campaign.completedTasks /
                                          campaign.totalTasks) *
                                        100
                                      }%`,
                                    }}
                                  ></div>
                                </div>
                              </div>
                            )}
                          {campaign.status === "COMPLETED" &&
                            campaign.hasPendingReviews && (
                              <div className="mt-3 flex items-center text-sm text-red-400">
                                <AlertTriangle className="w-4 h-4 mr-1" />
                                <span>Has items pending supervisor review</span>
                              </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 ml-4">
                          {campaign.status === "PLANNED" && (
                            <Button
                              size="sm"
                              onClick={() =>
                                handleStartCampaign(campaign.id, campaign.name)
                              }
                              disabled={updateStatusMutation.isPending}
                            >
                              <Play className="w-4 h-4 mr-1" />
                              Start
                            </Button>
                          )}

                          {campaign.status === "ACTIVE" && (
                            <>
                              <Button
                                size="sm"
                                onClick={() =>
                                  router.push(
                                    `/dashboard/inventory/count/${campaign.id}`
                                  )
                                }
                              >
                                Count
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handlePauseCampaign(
                                    campaign.id,
                                    campaign.name
                                  )
                                }
                                disabled={updateStatusMutation.isPending}
                              >
                                <Pause className="w-4 h-4" />
                              </Button>
                            </>
                          )}

                          {campaign.status === "PAUSED" && (
                            <Button
                              size="sm"
                              onClick={() =>
                                handleStartCampaign(campaign.id, campaign.name)
                              }
                              disabled={updateStatusMutation.isPending}
                            >
                              <Play className="w-4 h-4 mr-1" />
                              Resume
                            </Button>
                          )}

                          {campaign.status === "COMPLETED" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  router.push(
                                    `/dashboard/inventory/count/${campaign.id}/results`
                                  )
                                }
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                View Results
                              </Button>

                              {campaign.hasPendingReviews && (
                                <Button
                                  size="sm"
                                  className="bg-blue-500 hover:bg-blue-600"
                                  onClick={() =>
                                    router.push(
                                      `/dashboard/inventory/count/${campaign.id}/review`
                                    )
                                  }
                                >
                                  <AlertTriangle className="w-4 h-4 mr-1" />
                                  Review
                                </Button>
                              )}
                            </>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(
                                    `/dashboard/inventory/count/${campaign.id}`
                                  )
                                }
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>

                              {(campaign.status === "PLANNED" ||
                                campaign.status === "PAUSED") && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    router.push(
                                      `/dashboard/inventory/count/${campaign.id}/edit`
                                    )
                                  }
                                >
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit Campaign
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(
                                    `/dashboard/inventory/count/create?duplicate=${campaign.id}`
                                  )
                                }
                              >
                                <Copy className="w-4 h-4 mr-2" />
                                Duplicate
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => {
                                  toast({
                                    title: "Export Started",
                                    description: `Exporting ${campaign.name}...`,
                                    variant: "success",
                                  });
                                }}
                              >
                                <FileText className="w-4 h-4 mr-2" />
                                Export Report
                              </DropdownMenuItem>

                              {(campaign.status === "PLANNED" ||
                                campaign.status === "CANCELLED" ||
                                campaign.status === "COMPLETED") && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteClick(campaign)}
                                    className="text-red-400 focus:text-red-400 focus:bg-red-50 dark:focus:bg-red-950"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete Campaign
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  ))}
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
                        "Load More Campaigns"
                      )}
                    </Button>
                  </div>
                )}

                {/* Footer */}
                {filteredCampaigns.length > 0 && (
                  <div className="px-6 py-3 bg-gray-50 dark:bg-muted border-t dark:border-border text-sm text-gray-600 dark:text-gray-400 text-center">
                    Showing {filteredCampaigns.length} campaigns
                    {!hasNextPage && " (all loaded)"}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold">{campaignToDelete?.name}</span>?
              This action cannot be undone and will permanently remove all
              campaign data and tasks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Campaign"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
