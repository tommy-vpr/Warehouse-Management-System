"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ArrowRightLeft,
  CheckCircle,
  XCircle,
  Package,
  MapPin,
  User,
  Calendar,
  AlertTriangle,
  Loader2,
  Clock,
  FileText,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

interface TransferDetails {
  id: string;
  productVariantId: string;
  transactionType: string;
  quantityChange: number;
  locationId: string;
  referenceType: string;
  userId: string;
  notes: string;
  createdAt: string;
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
    confirmerName?: string;
    productName: string;
    approvedBy?: string;
    approvedAt?: string;
    approvalNotes?: string;
    rejectedBy?: string;
    rejectedAt?: string;
    rejectionNotes?: string;
  };
  user: {
    id: string;
    name: string;
  };
  productVariant: {
    id: string;
    sku: string;
    name: string;
    product: {
      name: string;
    };
  };
}

export default function TransferDetailsPage(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const transferId = params.id;

  const [confirmNotes, setConfirmNotes] = React.useState("");

  // Fetch transfer details
  const {
    data: transfer,
    isLoading,
    isError,
  } = useQuery<TransferDetails>({
    queryKey: ["transfer-details", transferId],
    queryFn: async () => {
      const response = await fetch(`/api/inventory/transfers/${transferId}`);
      if (!response.ok) {
        throw new Error("Transfer not found");
      }
      return response.json();
    },
    enabled: !!transferId,
  });

  // Approve mutation (only for pending transfers)
  const approveMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/inventory/transfers/pending/${transferId}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: confirmNotes }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to approve transfer");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Transfer Approved",
        description: "Inventory has been updated successfully",
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["transfer-details"] });
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      router.push("/dashboard/inventory/transfers");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reject mutation (only for pending transfers)
  const rejectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/inventory/transfers/pending/${transferId}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: confirmNotes }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reject transfer");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Transfer Rejected",
        description: "The requester has been notified",
        variant: "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["transfer-details"] });
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      router.push("/dashboard/inventory/transfers");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
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
        return <Clock className="w-5 h-5" />;
      case "APPROVED":
        return <CheckCircle className="w-5 h-5" />;
      case "REJECTED":
        return <XCircle className="w-5 h-5" />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600 dark:text-gray-400">
            Loading transfer details...
          </p>
        </div>
      </div>
    );
  }

  if (isError || !transfer) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Transfer not found</p>
          <Button
            onClick={() => router.push("/dashboard/inventory/transfers")}
            className="mt-4"
          >
            Back to Transfers
          </Button>
        </div>
      </div>
    );
  }

  const isPending = transfer.metadata.status === "PENDING";
  const isApproved = transfer.metadata.status === "APPROVED";
  const isRejected = transfer.metadata.status === "REJECTED";

  return (
    <div className="min-h-screen bg-background p-2">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard/inventory/transfers")}
            className="mr-4"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Transfer Details
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {isPending
                ? "Review and confirm inventory transfer"
                : "Transfer history and details"}
            </p>
          </div>
          <Badge
            className={`${getStatusColor(
              transfer.metadata.status
            )} text-xs px-4 py-2 flex items-center gap-2 rounded-4xl`}
          >
            {getStatusIcon(transfer.metadata.status)}
            {transfer.metadata.status}
          </Badge>
        </div>

        {/* Transfer Details Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <ArrowRightLeft className="w-5 h-5 mr-2" />
              Transfer Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Product Info */}
            <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-zinc-800 rounded-lg">
              <Package className="w-6 h-6 text-blue-600 mt-1" />
              <div className="flex-1">
                <div className="font-semibold text-lg">
                  {transfer.metadata.productName}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  SKU: {transfer.productVariant.sku}
                </div>
                <div className="text-2xl font-bold text-blue-600 mt-2">
                  {transfer.metadata.quantity} units
                </div>
              </div>
            </div>

            {/* Transfer Route */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div className="p-4 border-2 border-gray-300 dark:border-gray-600 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    From
                  </span>
                </div>
                <div className="font-semibold">
                  {transfer.metadata.fromLocationName}
                </div>
              </div>

              <div className="flex justify-center">
                <ArrowRightLeft className="w-8 h-8 text-blue-600" />
              </div>

              <div
                className={`p-4 border-2 rounded-lg ${
                  isApproved
                    ? "border-green-600"
                    : isRejected
                    ? "border-red-600"
                    : "border-blue-600"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <MapPin
                    className={`w-4 h-4 ${
                      isApproved
                        ? "text-green-600"
                        : isRejected
                        ? "text-red-600"
                        : "text-blue-600"
                    }`}
                  />
                  <span
                    className={`text-sm font-medium ${
                      isApproved
                        ? "text-green-600"
                        : isRejected
                        ? "text-red-600"
                        : "text-blue-600"
                    }`}
                  >
                    To
                  </span>
                </div>
                <div className="font-semibold">
                  {transfer.metadata.toLocationName}
                </div>
              </div>
            </div>

            {/* Request Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Requested by
                  </div>
                  <div className="font-medium text-sm">
                    {transfer.metadata.requestedByName}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Requested on
                  </div>
                  <div className="font-medium text-sm">
                    {new Date(transfer.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Request Notes */}
            {transfer.notes && (
              <div className="p-4 bg-gray-50 dark:bg-zinc-800 rounded-lg">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Request Notes:
                </div>
                <div className="text-gray-900 dark:text-gray-200 text-sm">
                  {transfer.notes
                    .replace("PENDING CONFIRMATION: ", "")
                    .replace("APPROVED: ", "")
                    .replace("REJECTED: ", "")}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Approval/Rejection Details */}
        {(isApproved || isRejected) && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                {isApproved ? (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                    Approval Details
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 mr-2 text-red-600" />
                    Rejection Details
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {isApproved ? "Approved by" : "Rejected by"}
                    </div>
                    <div className="font-medium text-sm">
                      {transfer.metadata.confirmerName || "System"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {isApproved ? "Approved on" : "Rejected on"}
                    </div>
                    <div className="font-medium text-sm">
                      {transfer.metadata.approvedAt
                        ? new Date(
                            transfer.metadata.approvedAt
                          ).toLocaleString()
                        : transfer.metadata.rejectedAt
                        ? new Date(
                            transfer.metadata.rejectedAt
                          ).toLocaleString()
                        : "N/A"}
                    </div>
                  </div>
                </div>
              </div>

              {(transfer.metadata.approvalNotes ||
                transfer.metadata.rejectionNotes) && (
                <div className="p-4 bg-gray-50 dark:bg-zinc-800 rounded-lg">
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    {isApproved ? "Approval" : "Rejection"} Notes:
                  </div>
                  <div className="text-gray-900 dark:text-gray-200">
                    {transfer.metadata.approvalNotes ||
                      transfer.metadata.rejectionNotes}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Confirmation Section (Only for Pending) */}
        {isPending && (
          <Card>
            <CardHeader>
              <CardTitle>Confirm Transfer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Confirmation Notes (Optional)
                </label>
                <textarea
                  value={confirmNotes}
                  onChange={(e) => setConfirmNotes(e.target.value)}
                  placeholder="Add any notes about this confirmation..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-green-400 hover:bg-green-500"
                  onClick={() => approveMutation.mutate()}
                  disabled={
                    approveMutation.isPending || rejectMutation.isPending
                  }
                >
                  {approveMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Approving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve Transfer
                    </>
                  )}
                </Button>

                <Button
                  className="flex-1 bg-red-400 hover:bg-red-500"
                  onClick={() => rejectMutation.mutate()}
                  disabled={
                    approveMutation.isPending || rejectMutation.isPending
                  }
                >
                  {rejectMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Rejecting...
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject Transfer
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons for Completed Transfers */}
        {!isPending && (
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard/inventory/transfers")}
              className="flex-1 cursor-pointer"
            >
              Back to Transfers
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                router.push(
                  `/dashboard/inventory/product/${transfer.productVariantId}`
                )
              }
              className="flex-1 cursor-pointer"
            >
              View Product
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
