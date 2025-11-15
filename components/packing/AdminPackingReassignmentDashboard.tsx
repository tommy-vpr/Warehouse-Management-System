// components/packing/AdminPackingReassignmentDashboard.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Package,
  AlertTriangle,
  Activity,
  TrendingUp,
  Clock,
  History,
  Loader2,
} from "lucide-react";
import type { ReassignmentReason } from "@/types/audit-trail";
import { toast } from "@/hooks/use-toast";

// Standardized reassignment reasons matching the audit trail system
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

interface Order {
  id: string;
  orderNumber: string;
}

interface TaskItem {
  id: string;
  order?: Order;
}

interface PackingTask {
  id: string;
  taskNumber: string;
  status: "IN_PROGRESS" | "ASSIGNED" | "PAUSED" | "COMPLETED";
  totalOrders: number;
  completedOrders: number;
  assignedTo: string;
  taskItems?: TaskItem[];
}

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface StaffWithWorkload extends StaffMember {
  activeTasks: number;
  remainingOrders: number;
  packingTasks: PackingTask[];
}

interface TasksResponse {
  tasks?: PackingTask[];
}

interface AuditEvent {
  id: string;
  eventType: string;
  createdAt: string;
  notes?: string;
  data?: {
    fromUserName?: string;
    toUserName?: string;
    taskNumber?: string;
    continuationTaskNumber?: string;
    reason?: ReassignmentReason;
  };
}

function AdminPackingReassignmentDashboard() {
  const [selectedStaff, setSelectedStaff] = useState<StaffWithWorkload | null>(
    null
  );
  const [showAuditTrail, setShowAuditTrail] = useState(false);

  // Fetch users
  const { data: staffData = [], isLoading: staffLoading } = useQuery<
    StaffMember[]
  >({
    queryKey: ["users", "staff"],
    queryFn: async () => {
      const response = await fetch("/api/users?role=STAFF");
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
  });

  // Fetch packing tasks (with high limit for admin workload view)
  const {
    data: tasksResponse,
    isLoading: tasksLoading,
    refetch: reloadTasks,
  } = useQuery<TasksResponse | PackingTask[]>({
    queryKey: ["packing-tasks", "active"],
    queryFn: async () => {
      const response = await fetch(
        "/api/packing-tasks?status=IN_PROGRESS,ASSIGNED,PAUSED&limit=1000"
      );
      if (!response.ok) throw new Error("Failed to fetch packing tasks");
      return response.json();
    },
    refetchInterval: 10000,
  });

  // Handle paginated response format
  const tasksData: PackingTask[] = Array.isArray(tasksResponse)
    ? tasksResponse
    : tasksResponse?.tasks || [];

  // Calculate workload for each staff
  const staff: StaffWithWorkload[] = staffData.map((s) => {
    const assignedTasks = tasksData.filter((t) => t.assignedTo === s.id);

    const totalRemaining = assignedTasks.reduce(
      (sum, t) => sum + (t.totalOrders - t.completedOrders),
      0
    );

    return {
      ...s,
      activeTasks: assignedTasks.length,
      remainingOrders: totalRemaining,
      packingTasks: assignedTasks,
    };
  });

  const loading = staffLoading || tasksLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto mb-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Packing Workload Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Monitor and reassign packing tasks across your warehouse team
          </p>
        </div>

        {/* Audit Trail Button */}
        <button
          onClick={() => setShowAuditTrail(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700 transition text-gray-900 dark:text-gray-100"
        >
          <History className="w-4 h-4" />
          <span>View Reassignment History</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<Users className="w-6 h-6" />}
          label="Active Staff"
          value={staff.filter((s) => s.activeTasks > 0).length}
          total={staff.length}
          color="blue"
        />
        <StatCard
          icon={<Package className="w-6 h-6" />}
          label="Active Tasks"
          value={tasksData.length}
          color="green"
        />
        <StatCard
          icon={<AlertTriangle className="w-6 h-6" />}
          label="Paused Tasks"
          value={tasksData.filter((t) => t.status === "PAUSED").length}
          color="orange"
        />
        <StatCard
          icon={<Activity className="w-6 h-6" />}
          label="Orders Remaining"
          value={tasksData.reduce(
            (sum, t) => sum + (t.totalOrders - t.completedOrders),
            0
          )}
          color="purple"
        />
      </div>

      {/* Staff Workload Table */}
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow mt-6 overflow-hidden">
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
                  Active Tasks
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Orders Remaining
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Tasks Details
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

      {/* Bulk Reassignment Modal */}
      {selectedStaff && (
        <BulkReassignmentModal
          staff={selectedStaff}
          allStaff={staff.filter((s) => s.id !== selectedStaff.id)}
          onClose={() => setSelectedStaff(null)}
          onSuccess={reloadTasks}
        />
      )}

      {/* Audit Trail Modal */}
      {showAuditTrail && (
        <ReassignmentAuditTrailModal onClose={() => setShowAuditTrail(false)} />
      )}
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
    <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6">
      <div className={`inline-flex p-3 rounded-lg ${colors[color]} mb-3`}>
        {icon}
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        {value}
        {total && (
          <span className="text-lg text-gray-400 dark:text-gray-500">
            /{total}
          </span>
        )}
      </div>
      <div className="text-sm text-gray-600 dark:text-gray-400">{label}</div>
    </div>
  );
}

interface StaffWorkloadRowProps {
  staff: StaffWithWorkload;
  onSelectStaff: () => void;
}

function StaffWorkloadRow({ staff, onSelectStaff }: StaffWorkloadRowProps) {
  const [expanded, setExpanded] = useState(false);

  const getWorkloadLevel = (): { label: string; color: string } => {
    if (staff.remainingOrders === 0) return { label: "Idle", color: "gray" };
    if (staff.remainingOrders < 10) return { label: "Light", color: "green" };
    if (staff.remainingOrders < 30)
      return { label: "Moderate", color: "yellow" };
    return { label: "Heavy", color: "red" };
  };

  const workloadLevel = getWorkloadLevel();

  const getStatusColor = (status: string): string => {
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
        {/* Staff Member */}
        <td className="px-6 py-4">
          <div>
            <div className="font-medium text-gray-900 dark:text-gray-100">
              {staff.name}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {staff.email}
            </div>
          </div>
        </td>

        {/* Workload Badge */}
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

        {/* Active Tasks Count */}
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {staff.activeTasks}
            </span>
          </div>
        </td>

        {/* Orders Remaining */}
        <td className="px-6 py-4">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {staff.remainingOrders}
          </div>
        </td>

        {/* Tasks Details Toggle */}
        <td className="px-6 py-4">
          {staff.packingTasks.length > 0 ? (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
            >
              {expanded ? "Hide" : "Show"} {staff.packingTasks.length} task(s)
              <span className="text-xs">{expanded ? "▲" : "▼"}</span>
            </button>
          ) : (
            <span className="text-sm text-gray-400 dark:text-gray-500">
              No tasks
            </span>
          )}
        </td>

        {/* Actions */}
        <td className="px-6 py-4 text-right">
          {staff.packingTasks.length > 0 && (
            <button
              onClick={onSelectStaff}
              className="px-3 py-1.5 bg-blue-600 dark:bg-blue-700 text-white text-sm rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition"
            >
              Reassign
            </button>
          )}
        </td>
      </tr>

      {/* Expanded Tasks Details */}
      {expanded && staff.packingTasks.length > 0 && (
        <tr>
          <td colSpan={6} className="px-6 py-4 bg-gray-50 dark:bg-zinc-900">
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase mb-2">
                Task Details
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {staff.packingTasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-white dark:bg-zinc-800 p-3 rounded border border-gray-200 dark:border-zinc-700"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                        {task.taskNumber}
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(
                          task.status
                        )}`}
                      >
                        {task.status.replace("_", " ")}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {task.completedOrders}/{task.totalOrders} orders
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500">
                      {task.totalOrders - task.completedOrders} remaining
                    </div>

                    {/* Order Numbers */}
                    {task.taskItems && task.taskItems.length > 0 && (
                      <div className="border-t border-gray-200 dark:border-zinc-700 pt-2 mt-2 flex gap-2">
                        <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Order:{" "}
                          {task.taskItems.slice(0, 3).map((item) => (
                            <span
                              key={item.id}
                              className="px-1.5 py-0.5 bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-300 rounded text-xs"
                            >
                              {item.order?.orderNumber || "N/A"}
                            </span>
                          ))}
                          {task.taskItems.length > 3 && (
                            <span className="px-1.5 py-0.5 text-gray-500 dark:text-gray-400 text-xs">
                              +{task.taskItems.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

interface BulkReassignmentModalProps {
  staff: StaffWithWorkload;
  allStaff: StaffWithWorkload[];
  onClose: () => void;
  onSuccess: () => void;
}

function BulkReassignmentModal({
  staff,
  allStaff,
  onClose,
  onSuccess,
}: BulkReassignmentModalProps) {
  const [targetStaffId, setTargetStaffId] = useState("");
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [reason, setReason] = useState<ReassignmentReason>("WORKLOAD_BALANCE");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleTask = (taskId: string) => {
    setSelectedTasks((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  };

  const totalOrdersReassigning = staff.packingTasks
    .filter((task) => selectedTasks.includes(task.id))
    .reduce((sum, task) => sum + (task.totalOrders - task.completedOrders), 0);

  const handleReassign = async () => {
    if (!targetStaffId || selectedTasks.length === 0) return;

    setLoading(true);

    try {
      const response = await fetch("/api/packing-tasks/reassign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskIds: selectedTasks,
          toUserId: targetStaffId,
          reason,
          notes: notes.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Reassignment failed");
      }

      toast({
        title: "✅ Reassignment Successful",
        description: `${selectedTasks.length} packing task(s) reassigned successfully`,
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Reassignment error:", error);
      toast({
        variant: "destructive",
        title: "❌ Reassignment Failed",
        description: (error as Error).message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-zinc-700">
          <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">
            Reassign Packing Tasks from {staff.name}
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Select destination staff member and tasks to reassign
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
                  {s.name} - {s.remainingOrders} orders remaining (
                  {s.activeTasks} active tasks)
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
              placeholder="Add context or details about this reassignment..."
              className="w-full border border-gray-300 dark:border-zinc-600 rounded-lg px-4 py-2 h-20 dark:bg-zinc-700 dark:text-gray-100 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              maxLength={500}
            />
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {notes.length}/500
            </div>
          </div>

          {/* Tasks Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Select Tasks *
              </label>
              <button
                onClick={() =>
                  setSelectedTasks(
                    selectedTasks.length === staff.packingTasks.length
                      ? []
                      : staff.packingTasks.map((t) => t.id)
                  )
                }
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                {selectedTasks.length === staff.packingTasks.length
                  ? "Deselect All"
                  : "Select All"}
              </button>
            </div>

            <div className="space-y-2">
              {staff.packingTasks.map((task) => (
                <label
                  key={task.id}
                  className="flex items-center gap-3 p-4 border border-gray-300 dark:border-zinc-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-700"
                >
                  <input
                    type="checkbox"
                    checked={selectedTasks.includes(task.id)}
                    onChange={() => toggleTask(task.id)}
                    className="w-4 h-4"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {task.taskNumber}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {task.completedOrders}/{task.totalOrders} completed •{" "}
                      {task.totalOrders - task.completedOrders} remaining
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      task.status === "IN_PROGRESS"
                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    }`}
                  >
                    {task.status.replace("_", " ")}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Summary */}
          {selectedTasks.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="text-sm text-blue-900 dark:text-blue-200">
                <strong>Summary:</strong> Reassigning {selectedTasks.length}{" "}
                task(s) with approximately {totalOrdersReassigning} remaining
                orders
                <br />
                <strong>Reason:</strong>{" "}
                {REASSIGNMENT_REASONS.find((r) => r.value === reason)?.label}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-zinc-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700 transition text-gray-900 dark:text-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleReassign}
            disabled={!targetStaffId || selectedTasks.length === 0 || loading}
            className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              `Reassign ${selectedTasks.length} Task(s)`
            )}
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
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReassignmentHistory();
  }, []);

  const loadReassignmentHistory = async () => {
    try {
      // Fetch recent reassignment events from task events
      const response = await fetch(
        "/api/task-events?type=PACKING&eventType=TASK_REASSIGNED,TASK_SPLIT,TASK_ASSIGNED&limit=50"
      );

      if (!response.ok) {
        console.error("Failed to fetch task events");
        setEvents([]);
        return;
      }

      const data: AuditEvent[] = await response.json();
      setEvents(data);
    } catch (error) {
      console.error("Failed to load reassignment history:", error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200 dark:border-zinc-700">
          <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">
            Reassignment History
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Recent packing task reassignments
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              No reassignments found
            </div>
          ) : (
            <div className="space-y-4">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="border border-gray-200 dark:border-zinc-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-zinc-700/50"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-gray-100">
                        {event.data?.fromUserName || "Unknown"} →{" "}
                        {event.data?.toUserName || "Unknown"}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Task:{" "}
                        {event.data?.taskNumber ||
                          event.data?.continuationTaskNumber}
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(event.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {event.data?.reason && (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Reason:{" "}
                      {REASSIGNMENT_REASONS.find(
                        (r) => r.value === event.data?.reason
                      )?.label || event.data.reason}
                    </div>
                  )}
                  {event.notes && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 italic mt-1">
                      {event.notes}
                    </div>
                  )}
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Event: {event.eventType.replace(/_/g, " ")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-zinc-700">
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

export default AdminPackingReassignmentDashboard;
