"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import clsx from "clsx";

interface PendingTransfer {
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
    productName: string;
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

export default function PendingTransferPage(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const transferId = params.id;

  const [confirmNotes, setConfirmNotes] = useState("");

  // Fetch pending transfer details
  const {
    data: transfer,
    isLoading,
    isError,
  } = useQuery<PendingTransfer>({
    queryKey: ["pending-transfer", transferId],
    queryFn: async () => {
      const response = await fetch(
        `/api/inventory/transfers/pending/${transferId}`
      );
      if (!response.ok) {
        throw new Error("Transfer not found");
      }
      return response.json();
    },
    enabled: !!transferId,
  });

  // Approve mutation
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
      queryClient.invalidateQueries({ queryKey: ["pending-transfer"] });
      router.push("/dashboard/inventory");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reject mutation
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
      queryClient.invalidateQueries({ queryKey: ["pending-transfer"] });
      router.push("/dashboard/inventory");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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
      <div className="min-h-screen bg-background flex items-center justify-center p-2">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            Transfer not found or already processed
          </p>
          <Button
            onClick={() => router.push("/dashboard/inventory")}
            className="mt-4"
          >
            Back to Inventory
          </Button>
        </div>
      </div>
    );
  }

  const isAlreadyProcessed = transfer.metadata.status !== "PENDING";

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard/inventory")}
            className="mr-4"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Transfer Confirmation
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Review and confirm inventory transfer
            </p>
          </div>
          <Badge
            className={clsx(
              "text-xs px-4 py-2 font-semibold rounded-4xl transition-colors duration-200",
              // light mode
              "bg-amber-100 text-amber-800",
              // dark mode
              "dark:bg-amber-900/30 dark:text-amber-400"
            )}
          >
            {transfer.metadata.status}
          </Badge>
        </div>

        {/* Transfer Details Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              Transfer Details
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

              <div className="p-4 border-2 border-blue-600 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-600">To</span>
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
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Request Notes:
                </div>
                <div className="text-gray-900 dark:text-gray-200">
                  {transfer.notes.replace("PENDING CONFIRMATION: ", "")}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Confirmation Section */}
        {!isAlreadyProcessed && (
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
                  className="px-4 cursor-pointer bg-green-500 hover:bg-green-700"
                  onClick={() => approveMutation.mutate()}
                  disabled={
                    approveMutation.isPending || rejectMutation.isPending
                  }
                >
                  {approveMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Approving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Approve
                    </>
                  )}
                </Button>

                <Button
                  className="cursor-pointer bg-red-400 hover:bg-red-500 transition"
                  onClick={() => rejectMutation.mutate()}
                  disabled={
                    approveMutation.isPending || rejectMutation.isPending
                  }
                >
                  {rejectMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Rejecting...
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      Reject
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Already Processed Message */}
        {isAlreadyProcessed && (
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-gray-600 dark:text-gray-400">
                This transfer has already been{" "}
                {transfer.metadata.status.toLowerCase()}.
              </div>
              <Button
                onClick={() => router.push("/dashboard/inventory")}
                className="mt-4"
              >
                Back to Inventory
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
