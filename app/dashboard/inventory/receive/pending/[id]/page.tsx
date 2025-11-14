// app/dashboard/inventory/receive/pending/[id]/page.tsx
// Mobile Responsive Version
"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User,
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  Building2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReceivingLine {
  id: string;
  sku: string;
  productName: string;
  quantityCounted: number;
  quantityExpected: number | null;
  variance: number | null;
}

interface ReceivingSession {
  id: string;
  poId: string;
  poReference: string;
  vendor: string | null;
  status: string;
  countedByUser: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  };
  countedAt: string;
  lineItems: ReceivingLine[];
}

export default function PendingApprovalDetailsPage(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: session } = useSession();
  const sessionId = params.id as string;

  const [actionType, setActionType] = useState<"APPROVE" | "REJECT" | null>(
    null
  );
  const [rejectionReason, setRejectionReason] = useState("");

  const canApprove =
    session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";

  // Fetch session details
  const {
    data: receivingSession,
    isLoading,
    error,
  } = useQuery<ReceivingSession>({
    queryKey: ["receiving-session", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/inventory/receive/po/pending/${sessionId}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to fetch session");
      }
      const json = await res.json();
      return json.session;
    },
  });

  // Approval mutation
  const approveMutation = useMutation({
    mutationFn: async ({
      action,
      reason,
    }: {
      action: "APPROVE" | "REJECT";
      reason?: string;
    }) => {
      const res = await fetch(`/api/inventory/receive/po/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, action, reason }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to process approval");
      }

      return res.json();
    },
    onSuccess: (result, variables) => {
      const isApproval = variables.action === "APPROVE";

      toast({
        variant: "success",
        title: isApproval ? "✅ Approved!" : "❌ Rejected",
        description: isApproval
          ? `Successfully received ${
              result.summary?.unitsReceived || 0
            } units (${
              result.summary?.itemsReceived || 0
            } SKUs) into inventory.`
          : "Receiving session has been rejected. The counter has been notified.",
      });

      if (result.backorders?.details?.length > 0) {
        setTimeout(() => {
          toast({
            variant: "success",
            title: "🎉 Backorders Fulfilled!",
            description: `${result.backorders.details.length} backorder(s) can now be picked and shipped.`,
          });
        }, 2000);
      }

      queryClient.invalidateQueries({ queryKey: ["pending-receiving"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      router.push("/dashboard/inventory/receive/pending");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "❌ Failed",
        description: error.message,
      });
    },
  });

  const handleAction = (action: "APPROVE" | "REJECT") => {
    setActionType(action);
    setRejectionReason("");
  };

  const handleConfirm = () => {
    if (actionType) {
      approveMutation.mutate({
        action: actionType,
        reason: actionType === "REJECT" ? rejectionReason : undefined,
      });
    }
  };

  // Calculate metrics
  const totalCounted =
    receivingSession?.lineItems.reduce(
      (sum, item) => sum + item.quantityCounted,
      0
    ) || 0;
  const totalExpected =
    receivingSession?.lineItems.reduce(
      (sum, item) => sum + (item.quantityExpected || 0),
      0
    ) || 0;
  const totalVariance = totalCounted - totalExpected;
  const variancePercentage =
    totalExpected > 0 ? (totalVariance / totalExpected) * 100 : 0;
  const itemsWithVariance =
    receivingSession?.lineItems.filter(
      (item) => item.variance !== null && item.variance !== 0
    ).length || 0;
  const hoursPending = receivingSession
    ? (new Date().getTime() - new Date(receivingSession.countedAt).getTime()) /
      (1000 * 60 * 60)
    : 0;

  const getVarianceColor = (variance: number | null) => {
    if (variance === null || variance === 0) return "text-gray-600";
    return variance > 0 ? "text-green-500" : "text-red-400";
  };

  const getVariancePercentageColor = (percentage: number) => {
    const abs = Math.abs(percentage);
    if (abs > 10) return "text-red-500";
    if (abs > 5) return "text-yellow-500";
    return "text-green-500";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 animate-spin text-blue-600 mx-auto mb-3 sm:mb-4" />
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Loading receiving session...
          </p>
        </div>
      </div>
    );
  }

  if (error || !receivingSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 sm:w-12 sm:h-12 text-red-500 mx-auto mb-3 sm:mb-4" />
          <p className="text-sm sm:text-base text-red-600 mb-2">
            Failed to load receiving session
          </p>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-4">
            {error?.message || "Session not found"}
          </p>
          <Button
            onClick={() => router.push("/dashboard/inventory/receive/pending")}
            size="sm"
          >
            Back to List
          </Button>
        </div>
      </div>
    );
  }

  if (!canApprove) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 sm:w-12 sm:h-12 text-yellow-500 mx-auto mb-3 sm:mb-4" />
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4">
            Only ADMIN or MANAGER roles can approve receiving.
          </p>
          <Button
            onClick={() => router.push("/dashboard/inventory/receive/pending")}
            size="sm"
          >
            Back to List
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => router.push("/dashboard/inventory/receive/pending")}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 mb-4 sm:mb-6 transition"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-sm sm:text-base">
            Back to Pending Approvals
          </span>
        </button>

        {/* Header Section */}
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 sm:mb-4 gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2">
                PO #{receivingSession.poReference}
              </h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                Review receiving session details
              </p>
            </div>
            <Badge
              variant="outline"
              className={`text-xs px-3 sm:px-4 py-1 sm:py-2 rounded-4xl ${
                receivingSession.status === "APPROVED"
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-300"
                  : receivingSession.status === "REJECTED"
                  ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-300"
                  : receivingSession.status === "CANCELLED"
                  ? "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 border-gray-300"
                  : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-300"
              }`}
            >
              {receivingSession.status === "APPROVED"
                ? "APPROVED"
                : receivingSession.status === "REJECTED"
                ? "REJECTED"
                : receivingSession.status === "CANCELLED"
                ? "CANCELLED"
                : "PENDING APPROVAL"}
            </Badge>
          </div>

          {/* Status Message for Processed Sessions */}
          {receivingSession.status !== "PENDING" && (
            <Card className="mb-4 sm:mb-6 border-blue-500 bg-blue-50 dark:bg-blue-900/20">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start gap-2 sm:gap-3">
                  {receivingSession.status === "APPROVED" ? (
                    <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 flex-shrink-0" />
                  )}
                  <div>
                    <p className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white">
                      {receivingSession.status === "APPROVED"
                        ? "This session has been approved"
                        : "This session has been rejected"}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      No further action needed. This is a read-only view.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
          {/* PO Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg">
                PO Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 sm:space-y-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    Vendor
                  </p>
                  <p className="font-medium text-sm sm:text-base truncate">
                    {receivingSession.vendor || "Unknown Vendor"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <User className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    Counted By
                  </p>
                  <p className="font-medium text-sm sm:text-base truncate">
                    {receivingSession.countedByUser.name ||
                      receivingSession.countedByUser.email}
                  </p>
                  <p className="text-xs text-gray-500">
                    {receivingSession.countedByUser.role}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
                <div>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    Counted At
                  </p>
                  <p className="font-medium text-sm sm:text-base">
                    {new Date(receivingSession.countedAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
                <div>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    Pending For
                  </p>
                  <p className="font-medium text-sm sm:text-base">
                    {Math.round(hoursPending * 10) / 10} hours
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Metrics */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg">
                Summary Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">
                    Line Items
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold">
                    {receivingSession.lineItems.length}
                  </p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">
                    Total Counted
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold">
                    {totalCounted.toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">
                      Variance
                    </p>
                    <p
                      className={`text-xl sm:text-2xl font-bold flex items-center gap-1 sm:gap-2 ${getVariancePercentageColor(
                        variancePercentage
                      )}`}
                    >
                      {variancePercentage > 0 ? (
                        <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
                      ) : variancePercentage < 0 ? (
                        <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6" />
                      ) : null}
                      {Math.abs(variancePercentage).toFixed(1)}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">
                      Items w/ Variance
                    </p>
                    <p
                      className={`text-xl sm:text-2xl font-bold ${
                        itemsWithVariance > 0
                          ? "text-yellow-500"
                          : "text-green-500"
                      }`}
                    >
                      {itemsWithVariance}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Variance Warning */}
        {Math.abs(variancePercentage) > 10 && (
          <Card className="mb-4 sm:mb-6 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-start gap-2 sm:gap-3">
                <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm sm:text-base text-yellow-800 dark:text-yellow-400 mb-1">
                    High Variance Detected
                  </p>
                  <p className="text-xs sm:text-sm text-yellow-700 dark:text-yellow-500">
                    This receiving session has a variance of{" "}
                    {Math.abs(variancePercentage).toFixed(1)}%. Please review
                    all line items carefully before approving.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Line Items - Desktop: Table, Mobile: Cards */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">
              Line Items ({receivingSession.lineItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop: Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-zinc-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Product
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      SKU
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Expected
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Counted
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Variance
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
                  {receivingSession.lineItems.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-4">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {item.productName}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {item.sku}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <p className="text-gray-600 dark:text-gray-400">
                          {item.quantityExpected || "—"}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <p className="font-bold text-lg">
                          {item.quantityCounted}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {item.variance !== null && item.variance !== 0 ? (
                          <div className="flex flex-col items-center">
                            <p
                              className={`text-lg ${getVarianceColor(
                                item.variance
                              )}`}
                            >
                              {item.variance > 0 ? "+" : ""}
                              {item.variance}
                            </p>
                            {item.quantityExpected && (
                              <p className="text-xs text-gray-500">
                                {(
                                  (item.variance / item.quantityExpected) *
                                  100
                                ).toFixed(1)}
                                %
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-gray-400">—</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: Cards */}
            <div className="md:hidden divide-y divide-gray-200 dark:divide-zinc-700">
              {receivingSession.lineItems.map((item) => (
                <div key={item.id} className="p-3 space-y-2">
                  <div>
                    <p className="font-medium text-sm text-gray-900 dark:text-white">
                      {item.productName}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      SKU: {item.sku}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">
                        Expected
                      </p>
                      <p className="font-medium text-sm">
                        {item.quantityExpected || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">
                        Counted
                      </p>
                      <p className="font-bold text-base">
                        {item.quantityCounted}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">
                        Variance
                      </p>
                      {item.variance !== null && item.variance !== 0 ? (
                        <div>
                          <p
                            className={`font-medium text-sm ${getVarianceColor(
                              item.variance
                            )}`}
                          >
                            {item.variance > 0 ? "+" : ""}
                            {item.variance}
                          </p>
                          {item.quantityExpected && (
                            <p className="text-xs text-gray-500">
                              {(
                                (item.variance / item.quantityExpected) *
                                100
                              ).toFixed(1)}
                              %
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-gray-400 text-sm">—</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons - Bottom */}
        {canApprove && receivingSession.status === "PENDING" && (
          <div className="flex flex-col sm:flex-row ml-auto gap-2 sm:gap-3 mt-4 sm:mt-6 xl:w-1/2">
            <Button
              onClick={() => handleAction("REJECT")}
              disabled={approveMutation.isPending}
              className="flex-1 bg-red-400 hover:bg-red-500 text-base py-2 sm:py-3 transition"
            >
              Reject
            </Button>
            <Button
              onClick={() => handleAction("APPROVE")}
              disabled={approveMutation.isPending}
              className="flex-1 bg-green-500 hover:bg-green-600 text-base py-2 sm:py-3 transition"
            >
              Approve & Receive
            </Button>
          </div>
        )}

        {/* Confirmation Dialog */}
        <AlertDialog
          open={actionType !== null}
          onOpenChange={(open) => {
            if (!open) {
              setActionType(null);
              setRejectionReason("");
            }
          }}
        >
          <AlertDialogContent className="max-w-[95vw] sm:max-w-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base sm:text-lg">
                {actionType === "APPROVE"
                  ? "Approve Receiving?"
                  : "Reject Receiving?"}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="text-sm sm:text-base">
                  {actionType === "APPROVE" ? (
                    <div className="space-y-3 sm:space-y-4">
                      <p>
                        This will add <strong>{totalCounted} units</strong> to
                        inventory from PO #{receivingSession.poReference}.
                      </p>
                      {Math.abs(variancePercentage) > 5 && (
                        <div className="p-3 sm:p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                          <p className="font-semibold text-yellow-800 dark:text-yellow-400 text-sm sm:text-base">
                            Variance: {Math.abs(variancePercentage).toFixed(1)}%
                          </p>
                          <p className="text-xs sm:text-sm text-yellow-700 dark:text-yellow-500">
                            {itemsWithVariance} item(s) have count differences.
                          </p>
                        </div>
                      )}
                      <p className="text-xs sm:text-sm">
                        Are you sure you want to approve this receiving session?
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 sm:space-y-4">
                      <p>
                        This will reject the receiving session for PO #
                        {receivingSession.poReference}. No inventory will be
                        updated.
                      </p>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                          Rejection Reason (optional)
                        </label>
                        <Textarea
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="Explain why this session is being rejected..."
                          rows={3}
                          className="w-full text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel
                disabled={approveMutation.isPending}
                className="w-full sm:w-auto"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirm}
                disabled={approveMutation.isPending}
                className={`w-full sm:w-auto ${
                  actionType === "REJECT"
                    ? "bg-red-400 hover:bg-red-500"
                    : "bg-green-400 hover:bg-green-500"
                }`}
              >
                {approveMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : actionType === "APPROVE" ? (
                  "Yes, Approve & Receive"
                ) : (
                  "Yes, Reject"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
