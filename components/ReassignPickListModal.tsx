// components/ReassignPickListModal.tsx
"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ReassignModalProps {
  open: boolean;
  onClose: () => void;
  selectedPickLists: Array<{
    id: string;
    batchNumber: string;
    status: string;
    assignedUser?: { name: string | null; email: string } | null;
  }>;
  staff: Array<{
    id: string;
    name: string | null;
    email: string;
    workload?: {
      activePickLists: number;
      remainingItems: number;
      status: string;
    };
  }>;
}

export function ReassignPickListModal({
  open,
  onClose,
  selectedPickLists,
  staff,
}: ReassignModalProps) {
  const [selectedStaff, setSelectedStaff] = useState("");
  const [reason, setReason] = useState<string>("WORKLOAD_BALANCING");
  const [notes, setNotes] = useState("");
  const [strategy, setStrategy] = useState<"simple" | "split">("split");
  const queryClient = useQueryClient();

  // Check if any selected pick lists can't be reassigned
  const invalidPickLists = selectedPickLists.filter(
    (pl) => pl.status === "COMPLETED" || pl.status === "CANCELLED"
  );

  const reassignMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/pick-lists/reassign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickListIds: selectedPickLists.map((pl) => pl.id),
          toUserId: selectedStaff,
          strategy: "simple",
          reason,
          notes,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reassign");
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["pickLists"] });
      onClose();
      alert(
        `Successfully reassigned ${
          data.results?.length || selectedPickLists.length
        } pick list(s)`
      );
    },
    onError: (error: Error) => {
      alert(error.message);
    },
  });

  const handleReassign = () => {
    if (!selectedStaff) {
      alert("Please select a staff member");
      return;
    }

    if (invalidPickLists.length > 0) {
      alert(
        `Cannot reassign ${invalidPickLists.length} pick list(s) - they are completed or cancelled`
      );
      return;
    }

    reassignMutation.mutate();
  };

  const selectedStaffMember = staff.find((s) => s.id === selectedStaff);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-[calc(100%-2rem)] sm:w-full left-[50%] translate-x-[-50%] top-[50%] translate-y-[-50%] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reassign Pick Lists</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning for invalid pick lists */}
          {invalidPickLists.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-800 dark:text-red-200">
                  <p className="font-semibold mb-1">
                    {invalidPickLists.length} pick list(s) cannot be reassigned
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    {invalidPickLists.map((pl) => (
                      <li key={pl.id}>
                        {pl.batchNumber} - {pl.status}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Selected Pick Lists Summary */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
              Selected Pick Lists ({selectedPickLists.length})
            </h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {selectedPickLists.map((pl) => (
                <div
                  key={pl.id}
                  className="text-sm text-blue-800 dark:text-blue-300 flex items-center justify-between"
                >
                  <span className="font-medium">{pl.batchNumber}</span>
                  <span className="text-xs">
                    Currently: {pl.assignedUser?.name || "Unassigned"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* New Staff Selection */}
          <div>
            <Label htmlFor="staff">Reassign To</Label>
            <select
              id="staff"
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              className="w-full mt-1 px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-zinc-700 dark:text-gray-100"
            >
              <option value="">Select staff member...</option>
              {staff
                .sort(
                  (a, b) =>
                    (a.workload?.remainingItems || 0) -
                    (b.workload?.remainingItems || 0)
                )
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name || s.email} ({s.workload?.remainingItems || 0}{" "}
                    items)
                  </option>
                ))}
            </select>
          </div>

          {/* Staff Workload Info */}
          {selectedStaffMember?.workload && (
            <div className="bg-gray-50 dark:bg-zinc-900 rounded-lg p-3 border border-gray-200 dark:border-zinc-700">
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-2">
                Current Workload
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-gray-600 dark:text-gray-400">
                    Active Lists
                  </div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                    {selectedStaffMember.workload.activePickLists}
                  </div>
                </div>
                <div>
                  <div className="text-gray-600 dark:text-gray-400">
                    Items Remaining
                  </div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                    {selectedStaffMember.workload.remainingItems}
                  </div>
                </div>
                <div>
                  <div className="text-gray-600 dark:text-gray-400">Status</div>
                  <div
                    className={`font-semibold capitalize ${
                      selectedStaffMember.workload.status === "idle"
                        ? "text-gray-600"
                        : selectedStaffMember.workload.status === "light"
                        ? "text-green-600"
                        : selectedStaffMember.workload.status === "moderate"
                        ? "text-yellow-600"
                        : "text-red-600"
                    }`}
                  >
                    {selectedStaffMember.workload.status}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Strategy Selection */}
          {/* <div>
            <Label htmlFor="strategy">Reassignment Strategy</Label>
            <select
              id="strategy"
              value={strategy}
              onChange={(e) =>
                setStrategy(e.target.value as "simple" | "split")
              }
              className="w-full mt-1 px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-zinc-700 dark:text-gray-100"
            >
              <option value="split">
                Split (Create continuation for partial work)
              </option>
              <option value="simple">Simple (Transfer entire list)</option>
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {strategy === "split"
                ? "Recommended: Handles partial progress automatically"
                : "Only use for lists that haven't been started"}
            </p>
          </div> */}

          {/* Reason */}
          <div>
            <Label htmlFor="reason">Reason</Label>
            <select
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full mt-1 px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-zinc-700 dark:text-gray-100"
            >
              <option value="WORKLOAD_BALANCING">Workload Balancing</option>
              <option value="SHIFT_CHANGE">Shift Change</option>
              <option value="STAFF_UNAVAILABLE">Staff Unavailable</option>
              <option value="PRIORITY_CHANGE">Priority Change</option>
              <option value="EFFICIENCY_IMPROVEMENT">
                Efficiency Improvement
              </option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes..."
              className="mt-1"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={reassignMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleReassign}
            disabled={
              !selectedStaff ||
              reassignMutation.isPending ||
              invalidPickLists.length === selectedPickLists.length
            }
          >
            {reassignMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Reassigning...
              </>
            ) : (
              <>Reassign {selectedPickLists.length} Pick List(s)</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
