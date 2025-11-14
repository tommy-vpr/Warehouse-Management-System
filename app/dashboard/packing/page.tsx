"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Package,
  Check,
  AlertCircle,
  Search,
  Filter,
  Box,
  Loader2,
} from "lucide-react";

interface PageProps {
  params: Promise<Record<string, string>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface OrderItem {
  id: string;
  quantity: number;
  sku: string;
}

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  status: string;
  createdAt: string;
  items?: OrderItem[];
  packingAssignedTo?: string | null;
}

interface Workload {
  activePackingTasks: number;
  remainingOrders: number;
  status: "idle" | "light" | "moderate" | "heavy";
}

interface Staff {
  id: string;
  name: string;
  role: string;
  workload?: Workload;
}

function AssignOrdersToPacking({ params, searchParams }: PageProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [selectedStaff, setSelectedStaff] = useState("");
  const [priority, setPriority] = useState(1);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersRes, staffRes] = await Promise.all([
        fetch("/api/orders?status=PICKED"),
        fetch("/api/users?role=STAFF&includeWorkload=true"),
      ]);

      const ordersData: Order[] = await ordersRes.json();
      const staffData: Staff[] = await staffRes.json();

      console.log("Picked orders:", ordersData);
      console.log("Staff data:", staffData);

      setOrders(ordersData);
      setStaff(staffData);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleOrder = (orderId: string) => {
    setSelectedOrders((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    );
  };

  const toggleAll = () => {
    if (selectedOrders.length === filteredOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filteredOrders.map((o) => o.id));
    }
  };

  const handleCreatePackingTask = async () => {
    if (!selectedStaff || selectedOrders.length === 0) {
      alert("Please select staff member and at least one order");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/packing-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIds: selectedOrders,
          assignedTo: selectedStaff,
          priority: priority,
        }),
      });

      if (response.ok) {
        const packingTask = await response.json();
        alert(`Packing task ${packingTask.taskNumber} created successfully!`);
        setSelectedOrders([]);
        setSelectedStaff("");
        loadData();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to create packing task");
      }
    } catch (error) {
      alert("Error creating packing task");
    } finally {
      setCreating(false);
    }
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const selectedOrdersData = filteredOrders.filter((o) =>
    selectedOrders.includes(o.id)
  );

  const totalItems = selectedOrdersData.reduce((sum, order) => {
    return sum + (order.items?.reduce((s, i) => s + i.quantity, 0) || 0);
  }, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Assign Orders to Packing
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Create packing tasks and assign them to packing staff
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Ready for Packing"
          value={orders.length}
          icon={<Box className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          label="Selected Orders"
          value={selectedOrders.length}
          icon={<Check className="w-5 h-5" />}
          color="green"
        />
        <StatCard
          label="Total Items"
          value={totalItems}
          icon={<Package className="w-5 h-5" />}
          color="purple"
        />
        <StatCard
          label="Available Staff"
          value={staff.length}
          icon={<Users className="w-5 h-5" />}
          color="orange"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Order Selection */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow">
            {/* Search */}
            <div className="p-4 border-b border-gray-200 dark:border-zinc-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  placeholder="Search orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:bg-zinc-700 dark:text-gray-100 dark:placeholder-gray-400"
                />
              </div>
            </div>

            {/* Select All */}
            <div className="px-4 py-3 bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={
                    selectedOrders.length === filteredOrders.length &&
                    filteredOrders.length > 0
                  }
                  onChange={toggleAll}
                  className="w-4 h-4 text-blue-600 dark:text-blue-500 rounded focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-zinc-700 dark:border-zinc-600"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  Select All ({filteredOrders.length} orders)
                </span>
              </label>
              {selectedOrders.length > 0 && (
                <button
                  onClick={() => setSelectedOrders([])}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                >
                  Clear Selection
                </button>
              )}
            </div>

            {/* Orders List */}
            <div className="max-h-[600px] overflow-y-auto">
              {filteredOrders.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <Box className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-600" />
                  <p>No orders found</p>
                </div>
              ) : (
                filteredOrders.map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    selected={selectedOrders.includes(order.id)}
                    onToggle={() => toggleOrder(order.id)}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Task Creation */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6 sticky top-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <Check className="w-5 h-5" />
              Create Packing Task
            </h3>

            {/* Summary */}
            {selectedOrders.length > 0 ? (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                <div className="text-sm text-blue-900 dark:text-blue-200">
                  <div className="flex justify-between mb-2">
                    <span>Selected Orders:</span>
                    <span className="font-semibold">
                      {selectedOrders.length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Items:</span>
                    <span className="font-semibold">{totalItems}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-4 mb-4 text-center">
                <AlertCircle className="w-8 h-8 text-gray-400 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Select orders from the list to create a packing task
                </p>
              </div>
            )}

            {/* Staff Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Assign To Packing Staff
              </label>
              <select
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-zinc-700 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={selectedOrders.length === 0}
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
                      {s.name} ({s.workload?.remainingOrders || 0} orders)
                    </option>
                  ))}
              </select>
            </div>

            {/* Priority */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-zinc-700 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={selectedOrders.length === 0}
              >
                <option value={0}>Normal</option>
                <option value={1}>High</option>
                <option value={2}>Urgent</option>
              </select>
            </div>

            {/* Selected Staff Info */}
            {selectedStaff && (
              <div className="mb-4 p-3 bg-gray-50 dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700">
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">
                  Current Workload
                </div>
                {(() => {
                  const staffMember = staff.find((s) => s.id === selectedStaff);
                  return staffMember?.workload ? (
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                          Active Tasks:
                        </span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {staffMember.workload.activePackingTasks}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                          Orders in Queue:
                        </span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {staffMember.workload.remainingOrders}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                          Status:
                        </span>
                        <span
                          className={`font-medium capitalize ${
                            staffMember.workload.status === "idle"
                              ? "text-gray-600 dark:text-gray-400"
                              : staffMember.workload.status === "light"
                                ? "text-green-600 dark:text-green-400"
                                : staffMember.workload.status === "moderate"
                                  ? "text-yellow-600 dark:text-yellow-400"
                                  : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {staffMember.workload.status}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      No active work
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Create Button */}
            <button
              onClick={handleCreatePackingTask}
              disabled={
                !selectedStaff || selectedOrders.length === 0 || creating
              }
              className="w-full bg-blue-600 dark:bg-blue-700 text-white py-3 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Create Packing Task
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: "blue" | "green" | "purple" | "orange";
}

function StatCard({ label, value, icon, color }: StatCardProps) {
  const colors = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    green:
      "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400",
    purple:
      "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
    orange:
      "bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
  };

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            {label}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {value}
          </p>
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}>{icon}</div>
      </div>
    </div>
  );
}

interface OrderRowProps {
  order: Order;
  selected: boolean;
  onToggle: () => void;
}

function OrderRow({ order, selected, onToggle }: OrderRowProps) {
  const itemCount =
    order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  return (
    <label className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-zinc-700/50 cursor-pointer border-b border-gray-100 dark:border-zinc-700 last:border-b-0">
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="w-4 h-4 text-blue-600 dark:text-blue-500 rounded focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-zinc-700 dark:border-zinc-600"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {order.orderNumber}
          </span>
          <span
            className={`px-2 py-1 rounded text-xs font-medium ${
              order.status === "PICKED"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
            }`}
          >
            {order.status}
          </span>
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-400">
          {order.customerName}
        </div>

        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-500">
          <span className="flex items-center gap-1">
            <Package className="w-3 h-3" />
            {itemCount} item{itemCount !== 1 ? "s" : ""}
          </span>
          <span>{new Date(order.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      {order.packingAssignedTo && (
        <div className="text-xs text-gray-500 dark:text-gray-400">Assigned</div>
      )}
    </label>
  );
}

export default AssignOrdersToPacking;
