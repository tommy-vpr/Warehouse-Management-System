// app/dashboard/inventory/receive/pending/page.tsx
// Mobile Responsive Version
"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  User,
  Calendar,
  Package,
  Clock,
  TrendingUp,
  TrendingDown,
  Eye,
  Search,
} from "lucide-react";
import { useState } from "react";

interface ComputedMetrics {
  totalCounted: number;
  totalExpected: number;
  totalVariance: number;
  variancePercentage: number;
  itemsWithVariance: number;
  largestVariance: number;
  hoursPending: number;
  needsAttention: boolean;
}

interface ReceivingSession {
  id: string;
  poId: string;
  poReference: string;
  vendor: string | null;
  status: string;
  countedByUser: {
    name: string | null;
    email: string;
    role: string;
  };
  countedAt: string;
  lineItems: any[];
  computed: ComputedMetrics;
}

interface PendingResponse {
  success: boolean;
  sessions: ReceivingSession[];
  summary: {
    totalPending: number;
    totalItems: number;
    totalUnits: number;
    sessionsWithVariances: number;
    oldestSession: string | null;
  };
  userRole: string;
}

export default function PendingApprovalsListPage(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const [searchTerm, setSearchTerm] = useState("");

  const canApprove =
    session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";

  const { data, isLoading, error } = useQuery<PendingResponse>({
    queryKey: ["pending-receiving"],
    queryFn: async () => {
      const res = await fetch(`/api/inventory/receive/po/pending`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to fetch pending approvals");
      }
      return res.json();
    },
    refetchInterval: 30000,
  });

  const filteredSessions = data?.sessions?.filter((session) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      session.poReference.toLowerCase().includes(searchLower) ||
      session.vendor?.toLowerCase().includes(searchLower) ||
      session.countedByUser.name?.toLowerCase().includes(searchLower) ||
      session.countedByUser.email.toLowerCase().includes(searchLower)
    );
  });

  const getVarianceColor = (variancePercentage: number) => {
    const absVariance = Math.abs(variancePercentage);
    if (absVariance > 10) return "text-red-400";
    if (absVariance > 5) return "text-yellow-500";
    return "text-green-500";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 animate-spin text-blue-600 mx-auto mb-3 sm:mb-4" />
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Loading pending approvals...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 sm:w-12 sm:h-12 text-red-500 mx-auto mb-3 sm:mb-4" />
          <p className="text-sm sm:text-base text-red-600 mb-2">
            Failed to load pending approvals
          </p>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-4">
            {(error as Error).message}
          </p>
          <Button
            onClick={() => router.back()}
            className="bg-blue-500 hover:bg-blue-600"
            size="sm"
          >
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  if (!canApprove && data?.userRole === "STAFF") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 sm:w-12 sm:h-12 text-yellow-500 mx-auto mb-3 sm:mb-4" />
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4">
            Only ADMIN or MANAGER roles can approve receiving.
          </p>
          <Button
            onClick={() => router.back()}
            className="bg-blue-500 hover:bg-blue-600"
            size="sm"
          >
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4 sm:mb-8">
          <button
            onClick={() => router.push("/dashboard/inventory/receive")}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 mb-4 transition"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-sm sm:text-base">Back to Receiving</span>
          </button>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2">
                Pending Approvals
              </h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                Review and approve receiving sessions
              </p>
            </div>
          </div>

          {/* Summary Cards */}
          {data?.summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center">
                    <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
                    <div className="ml-2 sm:ml-3">
                      <p className="text-lg sm:text-2xl font-bold">
                        {data.summary.totalPending}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        Pending
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center">
                    <Package className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
                    <div className="ml-2 sm:ml-3">
                      <p className="text-lg sm:text-2xl font-bold">
                        {data.summary.totalUnits.toLocaleString()}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        Units
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center">
                    <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500" />
                    <div className="ml-2 sm:ml-3">
                      <p className="text-lg sm:text-2xl font-bold">
                        {data.summary.sessionsWithVariances}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        Variances
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="col-span-2 md:col-span-1">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center">
                    <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600" />
                    <div className="ml-2 sm:ml-3">
                      <p className="text-base sm:text-lg font-bold">
                        {data.summary.oldestSession
                          ? `${Math.round(
                              (new Date().getTime() -
                                new Date(
                                  data.summary.oldestSession
                                ).getTime()) /
                                (1000 * 60 * 60)
                            )}h`
                          : "N/A"}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        Oldest
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Search */}
          <div className="mb-4 sm:mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by PO#, vendor, or counter..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 text-sm sm:text-base"
              />
            </div>
          </div>
        </div>

        {/* Sessions List */}
        <div className="space-y-3">
          {filteredSessions && filteredSessions.length === 0 && (
            <Card>
              <CardContent className="p-8 sm:p-12 text-center">
                <CheckCircle2 className="w-12 h-12 sm:w-16 sm:h-16 text-green-500 mx-auto mb-3 sm:mb-4" />
                <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No pending approvals
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {searchTerm
                    ? "No sessions match your search"
                    : "All receiving sessions have been processed"}
                </p>
              </CardContent>
            </Card>
          )}

          {filteredSessions?.map((session) => {
            const needsAttention = session.computed.needsAttention;

            return (
              <Card
                key={session.id}
                className={`hover:shadow-lg transition-all cursor-pointer ${
                  needsAttention ? "border-l-2 border-l-red-400" : ""
                }`}
                onClick={() =>
                  router.push(
                    `/dashboard/inventory/receive/pending/${session.id}`
                  )
                }
              >
                <CardContent className="p-4 sm:p-5">
                  {/* Desktop Layout */}
                  <div className="hidden lg:flex items-center justify-between">
                    <div className="flex-1">
                      {/* Header Row */}
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white">
                          <Badge variant={"outline"}>PO</Badge> #
                          {session.poReference}
                        </h3>
                        {needsAttention && (
                          <Badge className="text-xs bg-red-400">
                            NEEDS ATTENTION
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {session.computed.hoursPending}h pending
                        </Badge>
                      </div>

                      {/* Info Row */}
                      <div className="flex items-center flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600 dark:text-gray-400 mb-3">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4" />
                          <span>{session.vendor || "Unknown Vendor"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          <span>
                            {session.countedByUser.name ||
                              session.countedByUser.email}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {new Date(session.countedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* Metrics Row */}
                      <div className="flex items-center gap-6 text-sm">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">
                            Items:{" "}
                          </span>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {session.lineItems.length}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">
                            Units:{" "}
                          </span>
                          <span className="font-semibold">
                            {session.computed.totalCounted.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-gray-500 dark:text-gray-400">
                            Variance:{" "}
                          </span>
                          <span
                            className={`font-semibold flex items-center gap-1 ${getVarianceColor(
                              session.computed.variancePercentage
                            )}`}
                          >
                            {session.computed.variancePercentage > 0 ? (
                              <TrendingUp className="w-4 h-4" />
                            ) : session.computed.variancePercentage < 0 ? (
                              <TrendingDown className="w-4 h-4" />
                            ) : null}
                            {Math.abs(
                              session.computed.variancePercentage
                            ).toFixed(1)}
                            %
                          </span>
                        </div>
                        {session.computed.itemsWithVariance > 0 && (
                          <div>
                            <span className="text-yellow-600 dark:text-yellow-500 font-semibold">
                              {session.computed.itemsWithVariance} item
                              {session.computed.itemsWithVariance > 1
                                ? "s"
                                : ""}{" "}
                              with variance
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Button */}
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(
                          `/dashboard/inventory/receive/pending/${session.id}`
                        );
                      }}
                      className="ml-4 bg-blue-500 hover:bg-blue-600 text-white"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Review
                    </Button>
                  </div>

                  {/* Mobile Layout */}
                  <div className="lg:hidden space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={"outline"} className="text-xs">
                          PO
                        </Badge>
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                          #{session.poReference}
                        </h3>
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        {needsAttention && (
                          <Badge className="text-[10px] bg-red-400 whitespace-nowrap">
                            ATTENTION
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className="text-[10px] whitespace-nowrap"
                        >
                          {session.computed.hoursPending}h
                        </Badge>
                      </div>
                    </div>

                    {/* Vendor & Counter */}
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <Package className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">
                          {session.vendor || "Unknown Vendor"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <User className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">
                          {session.countedByUser.name ||
                            session.countedByUser.email}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <Calendar className="w-3 h-3 flex-shrink-0" />
                        <span>
                          {new Date(session.countedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">
                          Items
                        </span>
                        <p className="font-semibold text-sm text-gray-900 dark:text-white">
                          {session.lineItems.length}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">
                          Units
                        </span>
                        <p className="font-semibold text-sm">
                          {session.computed.totalCounted.toLocaleString()}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-500 dark:text-gray-400">
                          Variance
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`font-semibold text-sm flex items-center gap-1 ${getVarianceColor(
                              session.computed.variancePercentage
                            )}`}
                          >
                            {session.computed.variancePercentage > 0 ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : session.computed.variancePercentage < 0 ? (
                              <TrendingDown className="w-3 h-3" />
                            ) : null}
                            {Math.abs(
                              session.computed.variancePercentage
                            ).toFixed(1)}
                            %
                          </span>
                          {session.computed.itemsWithVariance > 0 && (
                            <span className="text-yellow-600 dark:text-yellow-500 text-xs">
                              ({session.computed.itemsWithVariance} item
                              {session.computed.itemsWithVariance > 1
                                ? "s"
                                : ""}
                              )
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(
                          `/dashboard/inventory/receive/pending/${session.id}`
                        );
                      }}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                      size="sm"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Review Session
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
