"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Download,
  FileText,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Package,
  MapPin,
  Calendar,
  Loader2,
  ArrowDown,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

interface CampaignResults {
  id: string;
  name: string;
  description?: string;
  countType: string;
  status: string;
  startDate: string;
  endDate?: string;
  totalTasks: number;
  completedTasks: number;
  variancesFound: number;
  accuracy: number;
  tasks: Array<{
    id: string;
    taskNumber: string;
    location: { name: string; zone?: string };
    productVariant?: {
      sku: string;
      name: string;
      product: { name: string };
    };
    systemQuantity: number;
    countedQuantity?: number;
    variance: number | null;
    variancePercentage: number | null;
    status: string;
    completedAt?: string;
    notes?: string;
    assignedUser?: {
      id: string;
      name: string;
    };
    events?: Array<{
      id: string;
      eventType: string;
      createdAt: string;
      user: {
        id: string;
        name: string;
      };
      notes?: string;
    }>;
  }>;
}

export default function CampaignResults(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const campaignId = params.id;

  const [exporting, setExporting] = useState(false);
  const [reporting, setReporting] = useState(false);

  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const [viewFilter, setViewFilter] = useState<
    "ALL" | "VARIANCES" | "COMPLETED"
  >("ALL");

  // Fetch campaign results
  const {
    data: results,
    isLoading,
    isError,
  } = useQuery<CampaignResults>({
    queryKey: ["campaign-results", campaignId],
    queryFn: async () => {
      const response = await fetch(
        `/api/inventory/cycle-counts/campaigns/${campaignId}?includeCompleted=true`
      );
      if (!response.ok) {
        throw new Error("Campaign not found");
      }
      return response.json();
    },
    enabled: !!campaignId,
    staleTime: 60000, // 1 minute - results don't change often
  });

  const exportResults = async () => {
    try {
      setExporting(true);
      const response = await fetch(
        `/api/inventory/cycle-counts/campaigns/${campaignId}/export`
      );
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `campaign-${results?.name}-results.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("Failed to export results:", error);
    } finally {
      setExporting(false);
    }
  };

  const generateReport = async () => {
    try {
      setReporting(true);
      const response = await fetch(
        `/api/inventory/cycle-counts/campaigns/${campaignId}/report`
      );

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: "application/pdf" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `cycle-count-report-${results?.name}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        console.error("Failed to generate report:", await response.text());
      }
    } catch (error) {
      console.error("Error generating report:", error);
    } finally {
      setReporting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 text-green-800 dark:bg-green-500 dark:text-green-900";
      case "VARIANCE_REVIEW":
        return "bg-orange-100 text-orange-800 dark:bg-orange-500 dark:text-orange-900";
      case "RECOUNT_REQUIred":
        return "bg-red-100 text-red-800 dark:bg-red-500 dark:text-red-900";
      case "SKIPPED":
        return "bg-purple-100 text-purple-800 dark:bg-purple-500 dark:text-purple-900";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-500 dark:text-gray-900";
    }
  };

  const formatVariance = (variance: number) => {
    return variance > 0 ? `+${variance}` : variance.toString();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600 dark:text-gray-400">
            Loading campaign results...
          </p>
        </div>
      </div>
    );
  }

  if (isError || !results) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Campaign not found</p>
          <Button
            onClick={() => router.push("/dashboard/inventory/count")}
            className="mt-4"
          >
            Back to Campaigns
          </Button>
        </div>
      </div>
    );
  }

  const filteredTasks = results.tasks.filter((task) => {
    switch (viewFilter) {
      case "VARIANCES":
        return (
          task.variance !== null &&
          task.variance !== undefined &&
          task.variance !== 0
        );
      case "COMPLETED":
        return task.status === "COMPLETED";
      default:
        return true;
    }
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Button
              variant="ghost"
              onClick={() => router.push("/dashboard/inventory/count")}
              className="mr-4"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-200">
                {results.name} - Results
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Campaign completion summary and analysis
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={exportResults}
              disabled={exporting} // disable while processing
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              {exporting ? "Exporting..." : "Export CSV"}
            </Button>

            <Button
              variant="outline"
              onClick={generateReport}
              disabled={reporting}
            >
              {reporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 mr-2" />
              )}
              {reporting ? "Generating..." : "Generate Report"}
            </Button>
          </div>
        </div>

        {/* Campaign Summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Campaign Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-700 dark:text-gray-200">
                  {results.totalTasks}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Total Tasks
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {results.completedTasks}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Completed
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-400">
                  {results.variancesFound}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Variances
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-700 dark:text-gray-200">
                  {results.accuracy.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Accuracy
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                <span>
                  {new Date(results.startDate).toLocaleDateString()} -{" "}
                  {results.endDate
                    ? new Date(results.endDate).toLocaleDateString()
                    : "Ongoing"}
                </span>
              </div>
              <div className="flex items-center">
                <Package className="w-4 h-4 mr-2 text-gray-400" />
                <span>{results.countType.replace(/_/g, " ")}</span>
              </div>
              <div className="flex items-center">
                <CheckCircle className="w-4 h-4 mr-2 text-gray-400" />
                <Badge className={getStatusColor(results.status)}>
                  {results.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Variance Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-green-600">
                <TrendingUp className="w-5 h-5 mr-2" />
                Positive Variances
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {results.tasks.filter((t) => (t.variance ?? 0) > 0).length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Items over system quantity
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-red-400">
                <TrendingDown className="w-5 h-5 mr-2" />
                Negative Variances
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-400">
                {results.tasks.filter((t) => (t.variance ?? 0) < 0).length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Items under system quantity
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-yellow-600">
                <AlertTriangle className="w-5 h-5 mr-2" />
                High Variances
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {
                  results.tasks.filter((t) => (t.variancePercentage || 0) > 10)
                    .length
                }
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Over 10% variance
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Task Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Task Details</span>
              <div className="flex gap-2">
                <Button
                  variant={viewFilter === "ALL" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewFilter("ALL")}
                >
                  All ({results.tasks.length})
                </Button>
                <Button
                  variant={viewFilter === "VARIANCES" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewFilter("VARIANCES")}
                >
                  Variances (
                  {
                    results.tasks.filter(
                      (t) => t.variance !== null && t.variance !== 0
                    ).length
                  }
                  )
                </Button>
                <Button
                  variant={viewFilter === "COMPLETED" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewFilter("COMPLETED")}
                >
                  Completed (
                  {results.tasks.filter((t) => t.status === "COMPLETED").length}
                  )
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b dark:text-gray-500">
                    <th className="text-left py-2 font-normal dark:text-gray-400">
                      Task
                    </th>
                    <th className="text-left py-2 font-normal dark:text-gray-400">
                      Location
                    </th>
                    <th className="text-left py-2 font-normal dark:text-gray-400">
                      Product
                    </th>
                    <th className="text-right py-2 font-normal dark:text-gray-400">
                      System Qty
                    </th>
                    <th className="text-right py-2 font-normal dark:text-gray-400">
                      Counted Qty
                    </th>
                    <th className="text-right py-2 font-normal dark:text-gray-400">
                      Variance
                    </th>
                    <th className="text-center py-2 font-normal dark:text-gray-400">
                      Status
                    </th>
                    {/* <th className="text-left py-2 font-normal">Audit Trail</th>
                    <th className="text-left py-2 font-normal">Notes</th> */}
                    <th className="text-left"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((task) => (
                    <React.Fragment key={task.id}>
                      <tr
                        key={task.id}
                        className="border-b hover:bg-background cursor-pointer"
                        onClick={() =>
                          setExpandedRow(
                            expandedRow === task.id ? null : task.id
                          )
                        }
                      >
                        <td className="py-2 font-medium">{task.taskNumber}</td>
                        <td className="py-2">
                          <div className="flex items-center">
                            <MapPin className="w-4 h-4 mr-1 text-gray-400" />
                            {task.location.name}
                          </div>
                        </td>
                        <td className="py-2">
                          {task.productVariant ? (
                            <div>
                              <div className="font-medium">
                                {task.productVariant.product.name}
                              </div>
                              <div className="text-gray-500 text-xs">
                                SKU: {task.productVariant.sku}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-500">
                              Location Count
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-right font-medium">
                          {task.systemQuantity}
                        </td>
                        <td className="py-2 text-right">
                          {task.countedQuantity !== null
                            ? task.countedQuantity
                            : "-"}
                        </td>
                        <td className="py-2 text-right">
                          {task.variance !== null &&
                          task.variance !== undefined ? (
                            <span
                              className={`font-medium ${
                                task.variance > 0
                                  ? "text-green-600"
                                  : task.variance < 0
                                  ? "text-red-400"
                                  : "text-gray-600"
                              }`}
                            >
                              {formatVariance(task.variance)}
                              {task.variancePercentage && (
                                <div className="text-xs text-gray-500">
                                  ({task.variancePercentage.toFixed(1)}%)
                                </div>
                              )}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="py-2 text-center">
                          <Badge className={getStatusColor(task.status)}>
                            {task.status.replace("_", " ")}
                          </Badge>
                        </td>

                        {/* <td className="py-2 text-xs">
                          <div className="space-y-1">
                            {task.assignedUser && (
                              <div className="text-gray-600">
                                <span className="font-medium">Counted by:</span>{" "}
                                {task.assignedUser.name}
                              </div>
                            )}

                            {task.events?.find(
                              (e) => e.eventType === "RECOUNT_REQUESTED"
                            ) && (
                              <div className="text-orange-600">
                                <span className="font-medium">
                                  Recount requested by:
                                </span>{" "}
                                {
                                  task.events.find(
                                    (e) => e.eventType === "RECOUNT_REQUESTED"
                                  )?.user.name
                                }
                              </div>
                            )}

                            {task.events?.find(
                              (e) =>
                                e.eventType === "VARIANCE_NOTED" &&
                                e.notes?.includes("approved")
                            ) && (
                              <div className="text-green-600">
                                <span className="font-medium">
                                  Approved by:
                                </span>{" "}
                                {
                                  task.events.find(
                                    (e) =>
                                      e.eventType === "VARIANCE_NOTED" &&
                                      e.notes?.includes("approved")
                                  )?.user.name
                                }
                              </div>
                            )}

                            {task.completedAt && (
                              <div className="text-gray-500">
                                {new Date(task.completedAt).toLocaleString()}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="py-2 max-w-xs truncate">
                          {task.notes || "-"}
                        </td> */}
                        <td className="h-full text-xs">
                          <div className="flex items-center justify-center gap-2 w-full h-full">
                            Expand Details
                            <ArrowDown size={14} />
                          </div>
                        </td>
                      </tr>

                      {/* Expandable audit trail */}
                      {expandedRow === task.id && (
                        <tr className="bg-gray-50 dark:bg-zinc-800">
                          <td colSpan={9} className="p-4">
                            <div className="text-xs">
                              <h4>{task.notes}</h4>
                              {/* <h4 className="font-semibold mb-2">
                                Full Audit Trail
                              </h4> */}
                              <div className="space-y-3">
                                {task.events?.map((event) => (
                                  <div
                                    key={event.id}
                                    className="flex justify-between"
                                  >
                                    <span>
                                      <span className="text-blue-400 mr-1">
                                        {event.eventType.replace("_", " ")}:
                                      </span>{" "}
                                      {event.user.name}
                                    </span>
                                    <span className="text-gray-500 dark:text-gray-400">
                                      {new Date(
                                        event.createdAt
                                      ).toLocaleString()}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>

              {filteredTasks.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No tasks match the current filter
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
