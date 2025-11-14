"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Truck,
  Package,
  CheckCircle,
  AlertCircle,
  Loader2,
  Copy,
} from "lucide-react";

export default function TestReserve(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { data: session, status } = useSession();
  const [orderId, setOrderId] = useState("");

  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (status === "loading") {
    return <div className="p-8">Loading...</div>;
  }

  if (!session) {
    return (
      <div className="p-8">
        <h1>Not authenticated</h1>
        <p>Please sign in first</p>
      </div>
    );
  }

  const handleApiCall = async (url: string, options: RequestInit = {}) => {
    setIsLoading(true);
    setResult("");

    try {
      console.log(`🔄 Making request to: ${url}`);

      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        ...options,
      });

      console.log(`📡 Response status: ${response.status}`);
      console.log(
        `📡 Response headers:`,
        Object.fromEntries(response.headers.entries())
      );

      const text = await response.text();
      console.log(`📄 Raw response:`, text.substring(0, 200));

      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        throw new Error(`Invalid JSON response: ${text.substring(0, 100)}...`);
      }

      if (response.ok) {
        setResult(JSON.stringify(data, null, 2));
      } else {
        setResult(
          `❌ Error ${response.status}: ${data.error || "Unknown error"}`
        );
      }
    } catch (error) {
      console.error("❌ Request failed:", error);
      setResult(
        `❌ Network Error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleReserve = () => {
    handleApiCall(`/api/orders/${orderId}/reserve`, { method: "POST" });
  };

  const handleGetOrders = () => {
    handleApiCall("/api/orders");
  };

  const handleCompleteOrder = () => {
    handleApiCall(`/api/orders/${orderId}/complete`, {
      method: "POST",
      body: JSON.stringify({
        serviceCode: "usps_ground_advantage",
        carrierCode: "usps",
      }),
    });
  };

  const handleShipOnly = () => {
    handleApiCall("/api/shipping/shipengine/create-label", {
      method: "POST",
      body: JSON.stringify({
        orderId: orderId,
        serviceCode: "usps_ground_advantage",
        carrierCode: "usps",
      }),
    });
  };

  const copyOrderId = (id: string) => {
    setOrderId(id);
    navigator.clipboard.writeText(id);
  };

  const formatOrdersResult = (jsonString: string) => {
    try {
      const data = JSON.parse(jsonString);
      if (Array.isArray(data)) {
        return data
          .map(
            (order) =>
              `📋 Order: ${order.orderNumber} (ID: ${order.id})
                👤 Customer: ${order.customerName}
                📊 Status: ${order.status}
                💰 Total: $${order.totalAmount}
                📦 Items: ${order.itemCount} (${order.totalQuantity} units)
                📅 Created: ${new Date(order.createdAt).toLocaleString()}
                🔗 Order ID: ${order.id} [Click Copy button to use]

              `
          )
          .join("\n");
      }
      return jsonString;
    } catch {
      return jsonString;
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Order Testing & Fulfillment</CardTitle>
          <p className="text-sm text-gray-600">
            Logged in as: {session.user?.email} ({session.user?.role})
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Order ID Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Order ID:</label>
            <Input
              placeholder="Enter Order ID (get from orders list below)"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
            />
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Button
              onClick={() => {
                handleGetOrders();
                setOrderId("");
              }}
              variant="outline"
              disabled={isLoading}
            >
              📋 Get All Orders
            </Button>

            <Button
              onClick={handleReserve}
              disabled={!orderId || isLoading}
              variant="outline"
            >
              🎯 Reserve Inventory
            </Button>

            <Button
              onClick={handleShipOnly}
              disabled={!orderId || isLoading}
              variant="outline"
            >
              🏷️ Create Label Only
            </Button>

            <Button
              onClick={handleCompleteOrder}
              disabled={!orderId || isLoading}
              className="md:col-span-3 bg-green-600 hover:bg-green-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Truck className="w-4 h-4 mr-2" />
                  🚀 COMPLETE ORDER (Full Flow)
                </>
              )}
            </Button>
          </div>

          {/* Quick Copy Buttons for Order IDs */}
          {result && result.includes('"id":') && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Quick Copy Order IDs:</h3>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  try {
                    const data = JSON.parse(result);
                    if (Array.isArray(data)) {
                      return data.slice(0, 5).map((order) => (
                        <Button
                          key={order.id}
                          size="sm"
                          variant="outline"
                          onClick={() => copyOrderId(order.id)}
                          className="text-xs"
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          {order.orderNumber}
                        </Button>
                      ));
                    }
                  } catch {
                    return null;
                  }
                })()}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">How to Test:</h3>
            <ol className="text-sm space-y-1 list-decimal list-inside">
              <li>
                <strong>Get Orders</strong> - See all orders and use quick copy
                buttons
              </li>
              <li>
                <strong>Reserve Inventory</strong> - Allocate stock (if order is
                PENDING)
              </li>
              <li>
                <strong>Complete Order</strong> - Full flow: Reserve + Ship +
                Fulfill + Notify
              </li>
            </ol>
          </div>

          {/* Results */}
          <div>
            <h3 className="font-semibold mb-2">Result:</h3>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-96 whitespace-pre-wrap">
              {result
                ? result.startsWith("[")
                  ? formatOrdersResult(result)
                  : result
                : 'No result yet - click "Get All Orders" to start!'}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
