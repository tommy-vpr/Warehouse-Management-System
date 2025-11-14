"use client";

import React, { useState } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

const WMSCostBreakdown = (props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) => {
  const [activeTab, setActiveTab] = useState("overview");
  const [userCount, setUserCount] = useState(1);
  const [orderVolume, setOrderVolume] = useState(400);
  const [storageGB, setStorageGB] = useState(20);

  // Calculate costs based on WMS usage - FIXED VERSION
  const calculateCosts = () => {
    // Supabase calculations
    const supabaseBase = 25;
    const dbStorage = storageGB > 8 ? (storageGB - 8) * 0.125 : 0;
    const fileStorage = storageGB > 100 ? (storageGB - 100) * 0.021 : 0;
    const bandwidth = ((orderVolume * 0.5) / 1000) * 0.09;
    const maus = userCount > 100 ? (userCount - 100) * 0.00325 : 0;
    const supabaseTotal =
      supabaseBase + dbStorage + fileStorage + bandwidth + maus;

    // GCP calculations
    const monthlyImagesMB = orderVolume * 1.7;
    const monthlyImagesGB = monthlyImagesMB / 1024;
    const gcpStorage = storageGB * 0.02;
    const uploadOps = ((orderVolume * 3) / 10000) * 0.05;
    const downloadOps = ((orderVolume * 4) / 10000) * 0.004;
    const gcpOperations = uploadOps + downloadOps;
    const egressMB = orderVolume * 1.5;
    const egressGB = egressMB / 1024;
    const gcpEgress = egressGB * 0.12;
    const gcpTotal = gcpStorage + gcpOperations + gcpEgress;

    // Vercel calculations
    const vercelSeats = Math.ceil(userCount / 5) * 20;
    const vercelBandwidthGB = orderVolume * 0.02;
    const vercelCredit = 20;
    const bandwidthOverageGB = Math.max(vercelBandwidthGB - 1000, 0);
    const bandwidthCost = (bandwidthOverageGB / 1000) * 150;
    const functionCalls = orderVolume * 5;
    const functionCost = Math.max(
      (functionCalls / 1000000) * 2 - vercelCredit,
      0
    );
    const vercelTotal = vercelSeats + bandwidthCost + Math.max(functionCost, 0);

    return {
      supabase: supabaseTotal,
      gcp: gcpTotal,
      vercel: vercelTotal,
      total: supabaseTotal + gcpTotal + vercelTotal,
    };
  };

  const costs = calculateCosts();
  const vercelSeats = Math.ceil(userCount / 5) * 20;

  // Monthly growth projection
  const growthProjection = [
    { month: "Month 1", orders: 300, cost: 26.6 },
    { month: "Month 2", orders: 400, cost: 26.79 },
    { month: "Month 3", orders: 500, cost: 26.98 },
    { month: "Month 4", orders: 750, cost: 27.51 },
    { month: "Month 5", orders: 1000, cost: 28.04 },
    { month: "Month 6", orders: 1500, cost: 29.08 },
  ];

  // Cost breakdown by service
  const costBreakdown = [
    { name: "Supabase", value: costs.supabase, color: "#3ECF8E" },
    { name: "GCP", value: costs.gcp, color: "#EA4335" },
    { name: "Vercel", value: costs.vercel, color: "#0070F3" },
  ];

  // Detailed WMS cost scenarios
  const scenarios = [
    {
      name: "Small Business",
      orders: 400,
      users: 1,
      storage: 20,
      supabase: 26.52,
      gcp: 0.27,
      vercel: 20,
      total: 46.79,
    },
    {
      name: "Growing Business",
      orders: 2000,
      users: 5,
      storage: 100,
      supabase: 32.36,
      gcp: 2.24,
      vercel: 20,
      total: 54.6,
    },
    {
      name: "Enterprise",
      orders: 10000,
      users: 20,
      storage: 500,
      supabase: 85.5,
      gcp: 10.74,
      vercel: 80,
      total: 176.24,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-zinc-900 dark:to-black">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-700 dark:to-blue-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-4xl font-bold">
                WMS Tech Stack Cost Breakdown
              </h1>
              <p className="mt-2 text-sm md:text-xl text-blue-100 dark:text-blue-200">
                Complete cost analysis for Supabase + GCP + Vercel
              </p>
            </div>
            <div className="text-right ml-auto mt-4 md:mt-0">
              <div className="text-sm text-blue-200 dark:text-blue-300">
                Estimated Monthly Cost
              </div>
              <div className="text-2xl md:text-4xl font-bold">
                ${costs.total.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="flex flex-wrap gap-1 bg-white dark:bg-zinc-800 rounded-lg p-1 shadow-sm dark:shadow-zinc-900/50">
          {["overview", "calculator", "wms-setup"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 px-4 rounded-md font-medium transition-colors ${
                activeTab === tab
                  ? "bg-gray-200 dark:bg-zinc-900"
                  : "text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-zinc-700"
              }`}
            >
              {tab === "wms-setup"
                ? "Our Setup"
                : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* What Each Technology Does - NEW SECTION */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-lg dark:shadow-zinc-900/50 p-6 border border-gray-200 dark:border-zinc-700">
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">
                What Each Technology Does in Our WMS
              </h3>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Supabase */}
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6 border-2 border-green-200 dark:border-green-800">
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold text-xl mr-3">
                      S
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-slate-800 dark:text-white">
                        Supabase
                      </h4>
                      <p className="text-sm text-green-600 dark:text-green-400">
                        Backend Infrastructure
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-white mb-1">
                        PostgreSQL Database
                      </div>
                      <p className="text-slate-600 dark:text-gray-400">
                        Stores all WMS data: orders, inventory, products, staff,
                        warehouse locations, cycle counts, purchase orders
                      </p>
                    </div>

                    <div>
                      <div className="font-semibold text-slate-800 dark:text-white mb-1">
                        Authentication & Authorization
                      </div>
                      <p className="text-slate-600 dark:text-gray-400">
                        User login, email verification, role-based permissions
                        (admin, warehouse staff, managers)
                      </p>
                    </div>

                    <div>
                      <div className="font-semibold text-slate-800 dark:text-white mb-1">
                        Real-time Subscriptions
                      </div>
                      <p className="text-slate-600 dark:text-gray-400">
                        Live updates for order status changes, inventory
                        movements, staff assignments via Ably integration
                      </p>
                    </div>

                    <div>
                      <div className="font-semibold text-slate-800 dark:text-white mb-1">
                        Edge Functions
                      </div>
                      <p className="text-slate-600 dark:text-gray-400">
                        Server-side logic for webhooks (Shopify sync), API
                        integrations (ShipEngine, Inventory Planner)
                      </p>
                    </div>

                    <div>
                      <div className="font-semibold text-slate-800 dark:text-white mb-1">
                        Row-Level Security
                      </div>
                      <p className="text-slate-600 dark:text-gray-400">
                        Ensures warehouse staff only see assigned tasks, admins
                        see everything
                      </p>
                    </div>
                  </div>
                </div>

                {/* Google Cloud Platform */}
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-6 border-2 border-red-200 dark:border-red-800">
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center text-white font-bold text-xl mr-3">
                      G
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-slate-800 dark:text-white">
                        Google Cloud
                      </h4>
                      <p className="text-sm text-red-600 dark:text-red-400">
                        File Storage & CDN
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-white mb-1">
                        Product Images
                      </div>
                      <p className="text-slate-600 dark:text-gray-400">
                        High-res photos of products for picking, packing
                        verification, and customer returns
                      </p>
                    </div>

                    <div>
                      <div className="font-semibold text-slate-800 dark:text-white mb-1">
                        Shipping Labels
                      </div>
                      <p className="text-slate-600 dark:text-gray-400">
                        Generated label PDFs from ShipEngine, stored for
                        reprinting and record-keeping
                      </p>
                    </div>

                    <div>
                      <div className="font-semibold text-slate-800 dark:text-white mb-1">
                        Documents & Invoices
                      </div>
                      <p className="text-slate-600 dark:text-gray-400">
                        Packing slips, commercial invoices, return labels,
                        barcode sheets for cycle counts
                      </p>
                    </div>

                    <div>
                      <div className="font-semibold text-slate-800 dark:text-white mb-1">
                        Package Photos
                      </div>
                      <p className="text-slate-600 dark:text-gray-400">
                        Proof-of-pack images taken by warehouse staff before
                        shipping
                      </p>
                    </div>

                    <div>
                      <div className="font-semibold text-slate-800 dark:text-white mb-1">
                        Fast Delivery
                      </div>
                      <p className="text-slate-600 dark:text-gray-400">
                        Cloud Storage CDN ensures images load quickly for mobile
                        devices in warehouse
                      </p>
                    </div>
                  </div>
                </div>

                {/* Vercel */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border-2 border-blue-200 dark:border-blue-800">
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-xl mr-3">
                      V
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-slate-800 dark:text-white">
                        Vercel Pro
                      </h4>
                      <p className="text-sm text-blue-600 dark:text-blue-400">
                        Frontend Hosting
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-white mb-1">
                        Next.js Application
                      </div>
                      <p className="text-slate-600 dark:text-gray-400">
                        Hosts entire WMS web application with server-side
                        rendering for optimal performance
                      </p>
                    </div>

                    <div>
                      <div className="font-semibold text-slate-800 dark:text-white mb-1">
                        Global Edge Network
                      </div>
                      <p className="text-slate-600 dark:text-gray-400">
                        Fast loading times worldwide with automatic CDN
                        distribution
                      </p>
                    </div>

                    <div>
                      <div className="font-semibold text-slate-800 dark:text-white mb-1">
                        Instant Deployments
                      </div>
                      <p className="text-slate-600 dark:text-gray-400">
                        Push code changes live in seconds with automatic builds
                        and preview URLs
                      </p>
                    </div>

                    <div>
                      <div className="font-semibold text-slate-800 dark:text-white mb-1">
                        Mobile-Responsive UI
                      </div>
                      <p className="text-slate-600 dark:text-gray-400">
                        Warehouse staff use Zebra TC22 devices to scan barcodes,
                        update inventory, and process orders
                      </p>
                    </div>

                    <div>
                      <div className="font-semibold text-slate-800 dark:text-white mb-1">
                        Serverless Functions
                      </div>
                      <p className="text-slate-600 dark:text-gray-400">
                        API routes for processing data, generating reports, and
                        handling webhooks
                      </p>
                    </div>

                    <div>
                      <div className="font-semibold text-slate-800 dark:text-white mb-1">
                        Team Collaboration
                      </div>
                      <p className="text-slate-600 dark:text-gray-400">
                        $20/seat allows multiple developers to deploy and manage
                        the application
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* How They Work Together */}
              <div className="mt-6 p-6 bg-slate-50 dark:bg-slate-900/20 rounded-lg border-2 border-slate-300 dark:border-slate-700">
                <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-3">
                  How They Work Together
                </h4>
                <div className="space-y-2 text-sm text-slate-600 dark:text-gray-400">
                  <p>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      Vercel
                    </span>{" "}
                    hosts the Next.js frontend that warehouse staff interact
                    with on their devices →
                  </p>
                  <p>
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      Supabase
                    </span>{" "}
                    provides the database, authentication, and real-time
                    features to manage all WMS operations →
                  </p>
                  <p>
                    <span className="font-semibold text-red-600 dark:text-red-400">
                      GCP
                    </span>{" "}
                    stores all images and documents, delivering them quickly
                    when staff need to verify products or print labels
                  </p>
                  <div className="mt-4 p-3 bg-white dark:bg-zinc-900/30 rounded border border-gray-300 dark:border-zinc-700">
                    <p className="text-slate-800 dark:text-white font-semibold">
                      Example: Processing an Order
                    </p>
                    <ol className="list-decimal list-inside mt-2 space-y-1 text-slate-600 dark:text-gray-400">
                      <li>
                        Order comes from Shopify →{" "}
                        <span className="font-semibold">Supabase</span> webhook
                        stores it
                      </li>
                      <li>
                        Warehouse staff opens{" "}
                        <span className="font-semibold">Vercel</span> app on
                        Zebra device
                      </li>
                      <li>
                        Staff scans barcode →{" "}
                        <span className="font-semibold">Supabase</span> updates
                        inventory
                      </li>
                      <li>
                        Product images load from{" "}
                        <span className="font-semibold">GCP</span> for
                        verification
                      </li>
                      <li>
                        Shipping label generates → stored in{" "}
                        <span className="font-semibold">GCP</span>, printed from
                        app
                      </li>
                      <li>
                        Real-time update via{" "}
                        <span className="font-semibold">Supabase</span> notifies
                        everyone order shipped
                      </li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
            {/* Current Cost Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Pie Chart */}
              <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-lg dark:shadow-zinc-900/50 p-6 border border-gray-200 dark:border-zinc-700">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4">
                  Monthly Cost Distribution
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={costBreakdown.filter((item) => item.value > 0)}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry: any) =>
                        `${entry.name}: $${entry.value.toFixed(2)}`
                      }
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {costBreakdown
                        .filter((item) => item.value > 0)
                        .map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => `$${Number(value).toFixed(2)}`}
                      contentStyle={{
                        backgroundColor: "#fff",
                        border: "1px solid rgb(63 63 70)",
                        borderRadius: "0.5rem",
                        color: "white",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Cost Summary */}
              <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-lg dark:shadow-zinc-900/50 p-6 border border-gray-200 dark:border-zinc-700">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4">
                  Cost Summary
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-white">
                        Supabase (Backend)
                      </div>
                      <div className="text-sm text-slate-600 dark:text-gray-400">
                        Database, Auth, Functions, Real-time
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      ${costs.supabase.toFixed(2)}
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-white">
                        GCP (Storage)
                      </div>
                      <div className="text-sm text-slate-600 dark:text-gray-400">
                        Images, Documents, Labels
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                      ${costs.gcp.toFixed(2)}
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-white">
                        Vercel Pro (Frontend)
                      </div>
                      <div className="text-sm text-slate-600 dark:text-gray-400">
                        $20/seat + overages (if any)
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      ${costs.vercel.toFixed(2)}
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-4 bg-purple-100 dark:bg-purple-900/30 rounded-lg border-2 border-purple-500 dark:border-purple-600">
                    <div>
                      <div className="font-bold text-slate-800 dark:text-white text-lg">
                        Total Monthly Cost
                      </div>
                      <div className="text-sm text-slate-600 dark:text-gray-400">
                        All services combined
                      </div>
                    </div>
                    <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                      ${costs.total.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Growth Projection */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-lg dark:shadow-zinc-900/50 p-6 border border-gray-200 dark:border-zinc-700">
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">
                6-Month Cost Projection
              </h3>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={growthProjection}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis dataKey="month" stroke="#888" />
                  <YAxis
                    yAxisId="left"
                    stroke="#888"
                    label={{
                      value: "Monthly Orders",
                      angle: -90,
                      position: "insideLeft",
                      fill: "#888",
                    }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#888"
                    label={{
                      value: "Cost (USD)",
                      angle: 90,
                      position: "insideRight",
                      fill: "#888",
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgb(39 39 42)",
                      border: "1px solid rgb(63 63 70)",
                      borderRadius: "0.5rem",
                      color: "white",
                    }}
                  />
                  <Legend />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="orders"
                    stroke="#3B82F6"
                    fill="#93C5FD"
                    name="Orders"
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="cost"
                    stroke="#10B981"
                    fill="#6EE7B7"
                    name="Cost ($)"
                  />
                </AreaChart>
              </ResponsiveContainer>
              <p className="mt-4 text-sm text-slate-600 dark:text-gray-400 text-center">
                Costs scale gradually as our order volume grows
              </p>
            </div>
          </div>
        )}

        {/* Calculator Tab */}
        {activeTab === "calculator" && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-lg dark:shadow-zinc-900/50 p-6 border border-gray-200 dark:border-zinc-700">
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">
                Custom Cost Calculator
              </h3>
              <p className="text-slate-600 dark:text-gray-400 mb-6">
                Adjust the sliders to estimate costs for our specific WMS needs
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-gray-300 mb-2">
                    Development Team Size
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={userCount}
                    onChange={(e) => setUserCount(parseInt(e.target.value))}
                    className="w-full h-2 bg-blue-200 dark:bg-blue-900 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-sm text-slate-600 dark:text-gray-400 mt-1">
                    <span>1</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      {userCount} devs
                    </span>
                    <span>20</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-gray-400 mt-2">
                    Developers who need to deploy code
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-gray-300 mb-2">
                    Monthly Order Volume
                  </label>
                  <input
                    type="range"
                    min="100"
                    max="10000"
                    step="100"
                    value={orderVolume}
                    onChange={(e) => setOrderVolume(parseInt(e.target.value))}
                    className="w-full h-2 bg-green-200 dark:bg-green-900 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-sm text-slate-600 dark:text-gray-400 mt-1">
                    <span>100</span>
                    <span className="font-bold text-green-600 dark:text-green-400">
                      {orderVolume.toLocaleString()} orders
                    </span>
                    <span>10K</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-gray-300 mb-2">
                    Storage Required (GB)
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="500"
                    step="10"
                    value={storageGB}
                    onChange={(e) => setStorageGB(parseInt(e.target.value))}
                    className="w-full h-2 bg-red-200 dark:bg-red-900 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-sm text-slate-600 dark:text-gray-400 mt-1">
                    <span>10GB</span>
                    <span className="font-bold text-red-600 dark:text-red-400">
                      {storageGB}GB
                    </span>
                    <span>500GB</span>
                  </div>
                </div>
              </div>

              {/* Calculated Costs */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6 border-2 border-green-200 dark:border-green-800">
                  <div className="text-sm text-slate-600 dark:text-gray-200 mb-1">
                    Supabase
                  </div>
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                    ${costs.supabase.toFixed(2)}
                  </div>
                </div>

                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-6 border-2 border-red-200 dark:border-red-800">
                  <div className="text-sm text-slate-600 dark:text-gray-200 mb-1">
                    Google Cloud
                  </div>
                  <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                    ${costs.gcp.toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                    {((orderVolume * 1.7) / 1024).toFixed(2)}GB/month growth
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border-2 border-blue-200 dark:border-blue-800">
                  <div className="text-sm text-slate-600 dark:text-gray-200 mb-1">
                    Vercel Pro
                  </div>
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    ${costs.vercel.toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                    ${vercelSeats}/mo + overages
                  </div>
                </div>

                <div className="bg-yellow-100 dark:bg-yellow-900/30 rounded-lg p-6 border-2 border-yellow-500 dark:border-yellow-600">
                  <div className="text-sm text-slate-600 dark:text-gray-200 mb-1">
                    Total Cost
                  </div>
                  <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                    ${costs.total.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* GCP Detailed Breakdown */}
              <div className="mt-8 p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border-2 border-red-200 dark:border-red-800">
                <h4 className="font-bold text-lg text-slate-800 dark:text-white mb-4 flex items-center">
                  GCP Cost Breakdown (Images: 2-4 per order, avg 3)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Storage */}
                  <div>
                    <div className="font-semibold text-red-600 dark:text-red-400 mb-2">
                      Storage:
                    </div>
                    <div className="space-y-1 text-sm text-slate-600 dark:text-gray-200">
                      <div className="flex justify-between">
                        <span>Current stored:</span>
                        <span className="font-semibold text-slate-800 dark:text-white">
                          {storageGB}GB
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Monthly growth:</span>
                        <span className="font-semibold text-slate-800 dark:text-white">
                          {((orderVolume * 1.7) / 1024).toFixed(2)}GB
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Cost ($0.02/GB):</span>
                        <span className="font-semibold text-slate-800 dark:text-white">
                          ${(storageGB * 0.02).toFixed(2)}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-gray-400 mt-2">
                        Images per order: ~3 (avg)
                        <br />
                        Size per order: ~1.7MB
                      </div>
                    </div>
                  </div>

                  {/* Operations */}
                  <div>
                    <div className="font-semibold text-red-600 dark:text-red-400 mb-2">
                      Operations:
                    </div>
                    <div className="space-y-1 text-sm text-slate-600 dark:text-gray-200">
                      <div className="flex justify-between">
                        <span>Uploads (Class A):</span>
                        <span className="font-semibold text-slate-800 dark:text-white">
                          ${(((orderVolume * 3) / 10000) * 0.05).toFixed(3)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Downloads (Class B):</span>
                        <span className="font-semibold text-slate-800 dark:text-white">
                          ${(((orderVolume * 4) / 10000) * 0.004).toFixed(3)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-gray-300 dark:border-zinc-600 pt-1">
                        <span>Total ops:</span>
                        <span className="font-semibold text-slate-800 dark:text-white">
                          $
                          {(
                            ((orderVolume * 3) / 10000) * 0.05 +
                            ((orderVolume * 4) / 10000) * 0.004
                          ).toFixed(3)}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-gray-400 mt-2">
                        3 uploads + 4 views per order
                      </div>
                    </div>
                  </div>

                  {/* Egress */}
                  <div>
                    <div className="font-semibold text-red-600 dark:text-red-400 mb-2">
                      Network Egress:
                    </div>
                    <div className="space-y-1 text-sm text-slate-600 dark:text-gray-200">
                      <div className="flex justify-between">
                        <span>Downloads/month:</span>
                        <span className="font-semibold text-slate-800 dark:text-white">
                          {((orderVolume * 1.5) / 1024).toFixed(2)}GB
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Cost ($0.12/GB):</span>
                        <span className="font-semibold text-slate-800 dark:text-white">
                          ${(((orderVolume * 1.5) / 1024) * 0.12).toFixed(3)}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-gray-400 mt-2">
                        ~1.5MB downloaded per order
                        <br />
                        (viewing images in app)
                      </div>
                    </div>
                  </div>
                </div>

                {/* Monthly Image Growth */}
                <div className="mt-4 p-4 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700">
                  <div className="font-semibold text-slate-800 dark:text-white mb-2">
                    Storage Growth Projection:
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-slate-600 dark:text-gray-400">
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-white">
                        Month 1:
                      </div>
                      <div>{((orderVolume * 1.7) / 1024).toFixed(2)}GB</div>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-white">
                        Month 6:
                      </div>
                      <div>{((orderVolume * 1.7 * 6) / 1024).toFixed(2)}GB</div>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-white">
                        Month 12:
                      </div>
                      <div>
                        {((orderVolume * 1.7 * 12) / 1024).toFixed(2)}GB
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-white">
                        our limit:
                      </div>
                      <div className="text-green-600 dark:text-green-400 font-bold">
                        {(storageGB / ((orderVolume * 1.7) / 1024)).toFixed(1)}{" "}
                        months
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Annual Projection */}
              <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-bold text-lg text-slate-800 dark:text-white">
                      Annual Cost Estimate
                    </div>
                    <div className="text-sm text-slate-600 dark:text-gray-400">
                      ${(costs.total / orderVolume).toFixed(4)} per order
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-bold text-yellow-600 dark:text-yellow-400">
                      ${(costs.total * 12).toFixed(2)}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-gray-400">
                      per year
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* our Setup Tab */}
        {activeTab === "wms-setup" && (
          <div className="space-y-6">
            <div className="bg-gray-600 dark:bg-zinc-800 text-white rounded-xl shadow-lg p-8">
              <h3 className="text-3xl font-bold mb-2">Our WMS Setup</h3>
              <p className="text-gray-100 dark:text-gray-400 text-lg mb-6">
                1 developer • 10 warehouse workers • 400 orders/month • 20GB
                storage
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-lg p-6 text-slate-800 dark:text-white border border-gray-200 dark:border-zinc-700">
                  <div className="text-sm mb-1">Monthly Cost</div>
                  <div className="text-5xl font-bold text-blue-500">$46.79</div>
                  <div className="text-xs text-slate-500 dark:text-gray-400 mt-2">
                    All services included
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-lg p-6 text-slate-800 dark:text-white border border-gray-200 dark:border-zinc-700">
                  <div className="text-sm mb-1">Annual Cost</div>
                  <div className="text-5xl font-bold text-blue-500">$561</div>
                  <div className="text-xs text-slate-500 dark:text-gray-400 mt-2">
                    Projected yearly spend
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-lg p-6 text-slate-800 dark:text-white border border-gray-200 dark:border-zinc-700">
                  <div className="text-sm mb-1">Per Order</div>
                  <div className="text-5xl font-bold text-blue-500">$0.117</div>
                  <div className="text-xs text-slate-500 dark:text-gray-400 mt-2">
                    11.7 cents per order
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WMSCostBreakdown;
