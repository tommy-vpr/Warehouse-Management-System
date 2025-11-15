// components/picking/ReassignPickListDialog.tsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, Users } from "lucide-react";
import type { ReassignmentReason } from "@/types/audit-trail";

interface User {
  id: string;
  name: string | null;
  email: string;
}

interface ReassignPickListDialogProps {
  pickListId: string;
  batchNumber: string;
  currentAssignee: User;
  availableUsers: User[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const REASSIGNMENT_REASONS: { value: ReassignmentReason; label: string }[] = [
  { value: "STAFF_UNAVAILABLE", label: "Staff Unavailable" },
  { value: "SHIFT_CHANGE", label: "Shift Change" },
  { value: "WORKLOAD_BALANCE", label: "Workload Balance" },
  { value: "EMERGENCY", label: "Emergency" },
  { value: "SKILL_MISMATCH", label: "Skill Mismatch" },
  { value: "EQUIPMENT_ISSUE", label: "Equipment Issue" },
  { value: "PERFORMANCE_ISSUE", label: "Performance Issue" },
  { value: "OTHER", label: "Other" },
];

export default function ReassignPickListDialog({
  pickListId,
  batchNumber,
  currentAssignee,
  availableUsers,
  open,
  onOpenChange,
  onSuccess,
}: ReassignPickListDialogProps) {
  const [newAssignedTo, setNewAssignedTo] = useState("");
  const [reason, setReason] = useState<ReassignmentReason | "">("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReassign = async () => {
    if (!newAssignedTo || !reason) {
      setError("Please select a user and reason");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/picking/lists/${pickListId}/reassign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            newAssignedTo,
            reason,
            notes: notes || undefined,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to reassign");
      }

      // Reset form
      setNewAssignedTo("");
      setReason("");
      setNotes("");

      // Call success callback and close dialog
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error("Reassignment failed:", err);
      setError(
        err instanceof Error ? err.message : "Failed to reassign pick list"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setNewAssignedTo("");
    setReason("");
    setNotes("");
    setError(null);
    onOpenChange(false);
  };

  // Filter out current assignee from available users
  const selectableUsers = availableUsers.filter(
    (user) => user.id !== currentAssignee.id
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Reassign Pick List
          </DialogTitle>
          <DialogDescription>
            Reassign {batchNumber} to a different picker
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>Current Assignee</Label>
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-md">
              <p className="font-medium">{currentAssignee.name || "Unknown"}</p>
              <p className="text-sm text-gray-500">{currentAssignee.email}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="newAssignee">Reassign To *</Label>
            <Select value={newAssignedTo} onValueChange={setNewAssignedTo}>
              <SelectTrigger id="newAssignee">
                <SelectValue placeholder="Select new assignee" />
              </SelectTrigger>
              <SelectContent>
                {selectableUsers.length === 0 ? (
                  <div className="p-2 text-sm text-gray-500">
                    No other users available
                  </div>
                ) : (
                  selectableUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex flex-col">
                        <span>{user.name || "Unknown"}</span>
                        <span className="text-xs text-gray-500">
                          {user.email}
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason *</Label>
            <Select
              value={reason}
              onValueChange={(value) => setReason(value as ReassignmentReason)}
            >
              <SelectTrigger id="reason">
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                {REASSIGNMENT_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional context..."
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-gray-500">{notes.length}/500</p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleReassign}
            disabled={
              !newAssignedTo ||
              !reason ||
              loading ||
              selectableUsers.length === 0
            }
            className="flex-1"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              "Reassign Pick List"
            )}
          </Button>
          <Button variant="outline" onClick={handleCancel} disabled={loading}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
