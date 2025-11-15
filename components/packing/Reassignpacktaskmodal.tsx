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
import { Loader2, AlertCircle, Package } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface PackingTask {
  id: string;
  taskNumber: string;
  status: string;
  totalOrders: number;
  completedOrders: number;
  assignedUser?: {
    id: string;
    name: string;
    email: string;
  };
}

interface Staff {
  id: string;
  name: string | null;
  email: string;
  workload?: {
    activePackingTasks: number;
    remainingOrders: number;
    status: string;
  };
}

interface ReassignPackingTaskModalProps {
  open: boolean;
  onClose: () => void;
  selectedTasks: PackingTask[];
  staff: Staff[];
}

export function ReassignPackingTaskModal({
  open,
  onClose,
  selectedTasks,
  staff,
}: ReassignPackingTaskModalProps) {
  const [selectedStaff, setSelectedStaff] = useState("");
  const [reason, setReason] = useState<string>("WORKLOAD_BALANCING");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  // Check if any selected tasks can't be reassigned
  const invalidTasks = selectedTasks.filter(
    (task) => task.status === "COMPLETED" || task.status === "CANCELLED"
  );

  const reassignMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/packing-tasks/reassign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskIds: selectedTasks.map((task) => task.id),
          toUserId: selectedStaff,
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
      queryClient.invalidateQueries({ queryKey: ["packingTasks"] });
      queryClient.invalidateQueries({ queryKey: ["my-work"] });
      onClose();
      alert(
        `Successfully reassigned ${
          data.results?.length || selectedTasks.length
        } packing task(s)`
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

    if (invalidTasks.length > 0) {
      alert(
        `Cannot reassign ${invalidTasks.length} task(s) - they are completed or cancelled`
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
          <DialogTitle>Reassign Packing Tasks</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning for invalid tasks */}
          {invalidTasks.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-800 dark:text-red-200">
                  <p className="font-semibold mb-1">
                    {invalidTasks.length} task(s) cannot be reassigned
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    {invalidTasks.map((task) => (
                      <li key={task.id}>
                        {task.taskNumber} - {task.status}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Selected Tasks Summary */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
              Selected Packing Tasks ({selectedTasks.length})
            </h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {selectedTasks.map((task) => (
                <div
                  key={task.id}
                  className="text-sm text-blue-800 dark:text-blue-300 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Package className="w-3 h-3" />
                    <span className="font-medium">{task.taskNumber}</span>
                    <span className="text-xs">
                      ({task.completedOrders}/{task.totalOrders} orders)
                    </span>
                  </div>
                  <span className="text-xs">
                    Currently: {task.assignedUser?.name || "Unassigned"}
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
                    (a.workload?.remainingOrders || 0) -
                    (b.workload?.remainingOrders || 0)
                )
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name || s.email} ({s.workload?.remainingOrders || 0}{" "}
                    orders)
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
                    Active Tasks
                  </div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                    {selectedStaffMember.workload.activePackingTasks}
                  </div>
                </div>
                <div>
                  <div className="text-gray-600 dark:text-gray-400">
                    Orders Remaining
                  </div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                    {selectedStaffMember.workload.remainingOrders}
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
              invalidTasks.length === selectedTasks.length
            }
          >
            {reassignMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              </>
            ) : (
              <>Reassign {selectedTasks.length} Task(s)</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
