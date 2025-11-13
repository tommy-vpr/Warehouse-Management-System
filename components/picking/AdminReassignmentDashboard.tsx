"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Package,
  AlertTriangle,
  Activity,
  TrendingUp,
  Clock,
  History,
  Loader2,
  X,
} from "lucide-react";
import type { ReassignmentReason } from "@/types/audit-trail";
import type {
  StaffMemberWithWorkload,
  PickListForAdmin,
  ReassignmentEvent,
  ReassignmentRequest,
} from "@/types/admin";
import { toast } from "@/hooks/use-toast";

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

function AdminReassignmentDashboard() {
  const [staff, setStaff] = useState<StaffMemberWithWorkload[]>([]);
  const [pickLists, setPickLists] = useState<PickListForAdmin[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedStaff, setSelectedStaff] =
    useState<StaffMemberWithWorkload | null>(null);
  const [showAuditTrail, setShowAuditTrail] = useState<boolean>(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    try {
      const [staffRes, pickListsRes] = await Promise.all([
        fetch("/api/users?role=STAFF"),
        fetch("/api/pick-lists?status=IN_PROGRESS,ASSIGNED,PAUSED&limit=1000"),
      ]);

      if (!staffRes.ok || !pickListsRes.ok) {
        throw new Error("Failed to fetch data");
      }

      const staffData = await staffRes.json();
      const pickListsResponse = await pickListsRes.json();
      const pickListsData: PickListForAdmin[] =
        pickListsResponse.pickLists || pickListsResponse;

      const staffWithWorkload: StaffMemberWithWorkload[] = staffData.map(
        (s: any) => {
          const assignedLists = pickListsData.filter(
            (pl) => pl.assignedTo === s.id
          );
          const totalRemaining = assignedLists.reduce(
            (sum, pl) => sum + (pl.totalItems - pl.pickedItems),
            0
          );

          return {
            ...s,
            activeLists: assignedLists.length,
            remainingItems: totalRemaining,
            pickLists: assignedLists,
          };
        }
      );

      setStaff(staffWithWorkload);
      setPickLists(pickListsData);
    } catch (error) {
      console.error("Failed to load data:", error);
      toast({
        variant: "destructive",
        title: "Error loading data",
        description: "Failed to fetch staff and pick lists",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6 overflow-x-hidden">
      <div className="max-w-7xl mx-auto">
        {/* Header - Responsive */}
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Staff Workload Management
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Monitor and reassign pick lists across your warehouse team
            </p>
          </div>

          {/* Audit Trail Button - Full width on mobile */}
          <button
            onClick={() => setShowAuditTrail(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700 transition text-gray-900 dark:text-gray-100"
          >
            <History className="w-4 h-4" />
            <span className="text-sm sm:text-base">
              View Reassignment History
            </span>
          </button>
        </div>

        {/* Summary Cards - Responsive Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <StatCard
            icon={<Users className="w-4 h-4 sm:w-6 sm:h-6" />}
            label="Active Staff"
            value={staff.filter((s) => s.activeLists > 0).length}
            total={staff.length}
            color="blue"
          />
          <StatCard
            icon={<Package className="w-4 h-4 sm:w-6 sm:h-6" />}
            label="Active Pick Lists"
            value={pickLists.length}
            color="green"
          />
          <StatCard
            icon={<AlertTriangle className="w-4 h-4 sm:w-6 sm:h-6" />}
            label="Paused Lists"
            value={pickLists.filter((pl) => pl.status === "PAUSED").length}
            color="orange"
          />
          <StatCard
            icon={<Activity className="w-4 h-4 sm:w-6 sm:h-6" />}
            label="Items Remaining"
            value={pickLists.reduce(
              (sum, pl) => sum + (pl.totalItems - pl.pickedItems),
              0
            )}
            color="purple"
          />
        </div>

        {/* Desktop: Table */}
        <div className="hidden lg:block bg-white dark:bg-zinc-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Staff Member
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Workload
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Active Lists
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Items Remaining
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Pick Lists
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-zinc-700">
                {staff.map((member) => (
                  <StaffWorkloadRow
                    key={member.id}
                    staff={member}
                    onSelectStaff={() => setSelectedStaff(member)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile: Cards */}
        <div className="lg:hidden space-y-3">
          {staff.map((member) => (
            <StaffWorkloadCard
              key={member.id}
              staff={member}
              onSelectStaff={() => setSelectedStaff(member)}
            />
          ))}
        </div>

        {/* Bulk Reassignment Modal */}
        {selectedStaff && (
          <BulkReassignmentModal
            staff={selectedStaff}
            allStaff={staff.filter((s) => s.id !== selectedStaff.id)}
            onClose={() => setSelectedStaff(null)}
            onSuccess={loadData}
          />
        )}

        {/* Audit Trail Modal */}
        {showAuditTrail && (
          <ReassignmentAuditTrailModal
            onClose={() => setShowAuditTrail(false)}
          />
        )}
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  total?: number;
  color: "blue" | "green" | "orange" | "purple";
}

function StatCard({ icon, label, value, total, color }: StatCardProps) {
  const colors = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    green:
      "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400",
    orange:
      "bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
    purple:
      "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
  };

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-3 sm:p-6">
      <div
        className={`inline-flex p-2 sm:p-3 rounded-lg ${colors[color]} mb-2 sm:mb-3`}
      >
        {icon}
      </div>
      <div className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
        {value}
        {total && (
          <span className="text-sm sm:text-lg text-gray-400 dark:text-gray-500">
            /{total}
          </span>
        )}
      </div>
      <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
        {label}
      </div>
    </div>
  );
}

interface StaffWorkloadRowProps {
  staff: StaffMemberWithWorkload;
  onSelectStaff: () => void;
}

function StaffWorkloadRow({ staff, onSelectStaff }: StaffWorkloadRowProps) {
  const [expanded, setExpanded] = useState(false);

  const getWorkloadLevel = () => {
    if (staff.remainingItems === 0) return { label: "Idle", color: "gray" };
    if (staff.remainingItems < 50) return { label: "Light", color: "green" };
    if (staff.remainingItems < 150)
      return { label: "Moderate", color: "yellow" };
    return { label: "Heavy", color: "red" };
  };

  const workloadLevel = getWorkloadLevel();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "IN_PROGRESS":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "ASSIGNED":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "PAUSED":
        return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
    }
  };

  return (
    <>
      <tr className="hover:bg-gray-50 dark:hover:bg-zinc-700/50">
        <td className="px-6 py-4">
          <div>
            <div className="font-medium text-gray-900 dark:text-gray-100">
              {staff.name || staff.email}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {staff.email}
            </div>
          </div>
        </td>

        <td className="px-6 py-4">
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium inline-flex items-center
              ${
                workloadLevel.color === "gray"
                  ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                  : workloadLevel.color === "green"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : workloadLevel.color === "yellow"
                  ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              }
            `}
          >
            {workloadLevel.label}
          </span>
        </td>

        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {staff.activeLists}
            </span>
          </div>
        </td>

        <td className="px-6 py-4">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {staff.remainingItems}
          </div>
        </td>

        <td className="px-6 py-4">
          {staff.pickLists.length > 0 ? (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
            >
              {expanded ? "Hide" : "Show"} {staff.pickLists.length} list(s)
              <span className="text-xs">{expanded ? "▲" : "▼"}</span>
            </button>
          ) : (
            <span className="text-sm text-gray-400 dark:text-gray-500">
              No lists
            </span>
          )}
        </td>

        <td className="px-6 py-4 text-right">
          {staff.pickLists.length > 0 && (
            <button
              onClick={onSelectStaff}
              className="px-3 py-1.5 bg-blue-600 dark:bg-blue-700 text-white text-sm rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition"
            >
              Reassign
            </button>
          )}
        </td>
      </tr>

      {expanded && staff.pickLists.length > 0 && (
        <tr>
          <td colSpan={6} className="px-6 py-4 bg-gray-50 dark:bg-zinc-900">
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase mb-2">
                Pick List Details
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {staff.pickLists.map((pl) => {
                  const orderNumbers = [
                    ...new Set(
                      pl.items
                        ?.map((item) => item.order?.orderNumber)
                        .filter(Boolean)
                    ),
                  ];

                  return (
                    <div
                      key={pl.id}
                      className="bg-white dark:bg-zinc-800 p-3 rounded border border-gray-200 dark:border-zinc-700"
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                          {pl.batchNumber}
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(
                            pl.status
                          )}`}
                        >
                          {pl.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {pl.pickedItems}/{pl.totalItems} picked
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500">
                        {pl.totalItems - pl.pickedItems} remaining
                      </div>
                      {orderNumbers.length > 0 && (
                        <div className="border-t border-gray-200 dark:border-zinc-700 pt-2 mt-2">
                          <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
                            Order: {orderNumbers.join(", ")}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// Mobile Card View Component
interface StaffWorkloadCardProps {
  staff: StaffMemberWithWorkload;
  onSelectStaff: () => void;
}

function StaffWorkloadCard({ staff, onSelectStaff }: StaffWorkloadCardProps) {
  const [expanded, setExpanded] = useState(false);

  const getWorkloadLevel = () => {
    if (staff.remainingItems === 0) return { label: "Idle", color: "gray" };
    if (staff.remainingItems < 50) return { label: "Light", color: "green" };
    if (staff.remainingItems < 150)
      return { label: "Moderate", color: "yellow" };
    return { label: "Heavy", color: "red" };
  };

  const workloadLevel = getWorkloadLevel();

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
            {staff.name || staff.email}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
            {staff.email}
          </div>
        </div>
        <span
          className={`ml-2 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
            workloadLevel.color === "gray"
              ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
              : workloadLevel.color === "green"
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : workloadLevel.color === "yellow"
              ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          }`}
        >
          {workloadLevel.label}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Active Lists
          </div>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {staff.activeLists}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Items Remaining
          </div>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {staff.remainingItems}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {staff.pickLists.length > 0 && (
          <>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700 text-gray-900 dark:text-gray-100"
            >
              {expanded ? "Hide" : "Show"} Lists
            </button>
            <button
              onClick={onSelectStaff}
              className="flex-1 px-3 py-2 text-sm bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600"
            >
              Reassign
            </button>
          </>
        )}
      </div>

      {/* Expanded Pick Lists */}
      {expanded && staff.pickLists.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-zinc-700 space-y-2">
          {staff.pickLists.map((pl) => (
            <div
              key={pl.id}
              className="p-2 bg-gray-50 dark:bg-zinc-900 rounded border border-gray-200 dark:border-zinc-700"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {pl.batchNumber}
                </div>
                <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  {pl.status}
                </span>
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {pl.pickedItems}/{pl.totalItems} picked •{" "}
                {pl.totalItems - pl.pickedItems} remaining
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface BulkReassignmentModalProps {
  staff: StaffMemberWithWorkload;
  allStaff: StaffMemberWithWorkload[];
  onClose: () => void;
  onSuccess: () => void;
}

function BulkReassignmentModal({
  staff,
  allStaff,
  onClose,
  onSuccess,
}: BulkReassignmentModalProps) {
  const [targetStaffId, setTargetStaffId] = useState<string>("");
  const [selectedLists, setSelectedLists] = useState<string[]>([]);
  const [reason, setReason] = useState<ReassignmentReason>("WORKLOAD_BALANCE");
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const toggleList = (listId: string) => {
    setSelectedLists((prev) =>
      prev.includes(listId)
        ? prev.filter((id) => id !== listId)
        : [...prev, listId]
    );
  };

  const totalItemsReassigning = staff.pickLists
    .filter((pl) => selectedLists.includes(pl.id))
    .reduce((sum, pl) => sum + (pl.totalItems - pl.pickedItems), 0);

  const handleReassign = async () => {
    if (!targetStaffId || selectedLists.length === 0) return;

    setLoading(true);

    try {
      const payload: ReassignmentRequest = {
        pickListIds: selectedLists,
        toUserId: targetStaffId,
        strategy: "simple",
        reason,
        notes: notes.trim() || undefined,
      };

      const response = await fetch("/api/pick-lists/reassign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Reassignment failed");
      }

      toast({
        title: "✅ Reassignment Successful",
        description: `${selectedLists.length} pick list(s) reassigned successfully`,
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Reassignment error:", error);
      toast({
        variant: "destructive",
        title: "❌ Reassignment Failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-800 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-zinc-700 flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">
              Reassign Pick Lists
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              from {staff.name || staff.email}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-2 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Target Staff Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reassign To *
            </label>
            <select
              value={targetStaffId}
              onChange={(e) => setTargetStaffId(e.target.value)}
              className="w-full border border-gray-300 dark:border-zinc-600 rounded-lg px-4 py-2 dark:bg-zinc-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            >
              <option value="">Select staff member...</option>
              {allStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name || s.email} - {s.remainingItems} items (
                  {s.activeLists} lists)
                </option>
              ))}
            </select>
          </div>

          {/* Reason Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reason *
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as ReassignmentReason)}
              className="w-full border border-gray-300 dark:border-zinc-600 rounded-lg px-4 py-2 dark:bg-zinc-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            >
              {REASSIGNMENT_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Additional Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add context or details..."
              className="w-full border border-gray-300 dark:border-zinc-600 rounded-lg px-4 py-2 h-20 text-sm dark:bg-zinc-700 dark:text-gray-100 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              maxLength={500}
            />
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {notes.length}/500
            </div>
          </div>

          {/* Pick Lists Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Select Pick Lists *
              </label>
              <button
                onClick={() =>
                  setSelectedLists(
                    selectedLists.length === staff.pickLists.length
                      ? []
                      : staff.pickLists.map((pl) => pl.id)
                  )
                }
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                {selectedLists.length === staff.pickLists.length
                  ? "Deselect All"
                  : "Select All"}
              </button>
            </div>

            <div className="space-y-2">
              {staff.pickLists.map((pl) => (
                <label
                  key={pl.id}
                  className="flex items-center gap-3 p-3 border border-gray-300 dark:border-zinc-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-700"
                >
                  <input
                    type="checkbox"
                    checked={selectedLists.includes(pl.id)}
                    onChange={() => toggleList(pl.id)}
                    className="w-4 h-4 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                      {pl.batchNumber}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {pl.pickedItems}/{pl.totalItems} picked •{" "}
                      {pl.totalItems - pl.pickedItems} remaining
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                      pl.status === "IN_PROGRESS"
                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    }`}
                  >
                    {pl.status}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Summary */}
          {selectedLists.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="text-xs sm:text-sm text-blue-900 dark:text-blue-200">
                <strong>Summary:</strong> Reassigning {selectedLists.length}{" "}
                pick list(s) with approximately {totalItemsReassigning}{" "}
                remaining items
                <br />
                <strong>Reason:</strong>{" "}
                {REASSIGNMENT_REASONS.find((r) => r.value === reason)?.label}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-zinc-700 flex flex-col sm:flex-row gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700 transition text-gray-900 dark:text-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleReassign}
            disabled={!targetStaffId || selectedLists.length === 0 || loading}
            className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition disabled:opacity-50"
          >
            {loading
              ? "Reassigning..."
              : `Reassign ${selectedLists.length} List(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ReassignmentAuditTrailModalProps {
  onClose: () => void;
}

function ReassignmentAuditTrailModal({
  onClose,
}: ReassignmentAuditTrailModalProps) {
  const [events, setEvents] = useState<ReassignmentEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadReassignmentHistory();
  }, []);

  const loadReassignmentHistory = async () => {
    try {
      const response = await fetch(
        "/api/pick-events?eventType=PICK_REASSIGNED,PICK_SPLIT&limit=50"
      );
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setEvents(data);
    } catch (error) {
      console.error("Failed to load reassignment history:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load reassignment history",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-zinc-700 flex items-start justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">
              Reassignment History
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Recent pick list reassignments
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-2 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              No reassignments found
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="border border-gray-200 dark:border-zinc-700 rounded-lg p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-zinc-700/50"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm sm:text-base text-gray-900 dark:text-gray-100">
                        {event.data?.fromUserName || "Unknown"} →{" "}
                        {event.data?.toUserName || "Unknown"}
                      </div>
                      <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        Pick List: {event.pickList?.batchNumber}
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {new Date(event.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {event.data?.reason && (
                    <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      Reason:{" "}
                      {REASSIGNMENT_REASONS.find(
                        (r) => r.value === event.data?.reason
                      )?.label || event.data.reason}
                    </div>
                  )}
                  {event.notes && (
                    <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 italic mt-1">
                      {event.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-zinc-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700 transition text-gray-900 dark:text-gray-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminReassignmentDashboard;
