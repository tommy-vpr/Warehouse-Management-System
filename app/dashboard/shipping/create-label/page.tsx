"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  Truck,
  User,
  MapPin,
  Weight,
  DollarSign,
  Calendar,
  CheckCircle,
  AlertCircle,
  Printer,
  Download,
  ArrowLeft,
  Clock,
  Box,
  Scale,
} from "lucide-react";

interface OrderItem {
  id: string;
  productSku: string;
  productName: string;
  quantity: number;
  weight: number;
  value: number;
}

interface ShippingAddress {
  name: string;
  company?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  countryCode: string;
  phone?: string;
  email?: string;
}

interface OrderDetails {
  id: string;
  orderNumber: string;
  status: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
  };
  shippingAddress: ShippingAddress;
  items: OrderItem[];
  totalWeight: number;
  totalValue: number;
  createdAt: string;
  packedAt?: string;
}

interface ShippingService {
  serviceCode: string;
  serviceName: string;
  estimatedDays: string;
  rate: number;
  carrierCode: string;
  carrierName: string;
}

interface PackageInfo {
  packageCode: string;
  weight: number;
  dimensions: {
    length: number;
    width: number;
    height: number;
    unit: string;
  };
}

interface ShippingLabel {
  labelId: string;
  trackingNumber: string;
  labelUrl: string;
  labelFormat: string;
  carrierCode: string;
  serviceCode: string;
  packageCode: string;
  shipDate: string;
  shipmentCost: {
    currency: string;
    amount: number;
  };
}

export default function ShippingLabelInterface(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [shippingServices, setShippingServices] = useState<ShippingService[]>(
    []
  );
  const [selectedService, setSelectedService] =
    useState<ShippingService | null>(null);
  const [packageInfo, setPackageInfo] = useState<PackageInfo>({
    packageCode: "package",
    weight: 0,
    dimensions: {
      length: 10,
      width: 8,
      height: 6,
      unit: "inch",
    },
  });
  const [shippingLabel, setShippingLabel] = useState<ShippingLabel | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);
  const [isLoadingRates, setIsLoadingRates] = useState(false);
  const [step, setStep] = useState<"review" | "rates" | "confirm" | "complete">(
    "review"
  );

  // Mock order ID - in real app, get from URL params
  const orderId = "order-123";

  useEffect(() => {
    loadOrderDetails();
  }, []);

  const loadOrderDetails = async () => {
    setIsLoading(true);
    try {
      // Mock data - replace with actual API call
      const mockOrder: OrderDetails = {
        id: orderId,
        orderNumber: "#1003",
        status: "PACKED",
        customer: {
          name: "John Smith",
          email: "john.smith@email.com",
          phone: "+1-555-0123",
        },
        shippingAddress: {
          name: "John Smith",
          company: "Acme Corp",
          addressLine1: "123 Main Street",
          addressLine2: "Suite 100",
          city: "Los Angeles",
          stateProvince: "CA",
          postalCode: "90210",
          countryCode: "US",
          phone: "+1-555-0123",
          email: "john.smith@email.com",
        },
        items: [
          {
            id: "1",
            productSku: "30ML-MGFR",
            productName: "Mango Fragrance Oil 30ml",
            quantity: 2,
            weight: 0.5,
            value: 24.99,
          },
          {
            id: "2",
            productSku: "30ML-MXBR",
            productName: "Mixed Berry Oil 30ml",
            quantity: 1,
            weight: 0.5,
            value: 24.0,
          },
        ],
        totalWeight: 1.5,
        totalValue: 73.98,
        createdAt: "2025-01-10T10:00:00Z",
        packedAt: "2025-01-10T14:30:00Z",
      };

      setOrder(mockOrder);
      setPackageInfo((prev) => ({
        ...prev,
        weight: mockOrder.totalWeight,
      }));
    } catch (error) {
      console.error("Failed to load order details:", error);
    }
    setIsLoading(false);
  };

  const getRates = async () => {
    if (!order) return;

    setIsLoadingRates(true);
    try {
      // Mock rates data - replace with actual ShipEngine API call
      const mockRates: ShippingService[] = [
        {
          serviceCode: "usps_ground_advantage",
          serviceName: "USPS Ground Advantage",
          estimatedDays: "2-5 business days",
          rate: 8.45,
          carrierCode: "usps",
          carrierName: "USPS",
        },
        {
          serviceCode: "usps_priority_mail",
          serviceName: "USPS Priority Mail",
          estimatedDays: "1-3 business days",
          rate: 12.8,
          carrierCode: "usps",
          carrierName: "USPS",
        },
        {
          serviceCode: "fedex_ground",
          serviceName: "FedEx Ground",
          estimatedDays: "1-5 business days",
          rate: 10.25,
          carrierCode: "fedex",
          carrierName: "FedEx",
        },
        {
          serviceCode: "ups_ground",
          serviceName: "UPS Ground",
          estimatedDays: "1-5 business days",
          rate: 9.75,
          carrierCode: "ups",
          carrierName: "UPS",
        },
      ];

      setShippingServices(mockRates);
      setStep("rates");
    } catch (error) {
      console.error("Failed to get shipping rates:", error);
    }
    setIsLoadingRates(false);
  };

  const createShippingLabel = async () => {
    if (!order || !selectedService) return;

    setIsCreatingLabel(true);
    try {
      // Replace with actual ShipEngine API call
      const labelResponse = await fetch(
        "/api/shipping/shipengine/create-label",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: order.id,
            serviceCode: selectedService.serviceCode,
            packageInfo,
            shippingAddress: order.shippingAddress,
          }),
        }
      );

      if (labelResponse.ok) {
        const labelData = await labelResponse.json();

        // Mock successful response
        const mockLabel: ShippingLabel = {
          labelId: "se-123456789",
          trackingNumber: "1Z999AA1234567890",
          labelUrl: "https://api.shipengine.com/v1/labels/se-123456789",
          labelFormat: "PDF",
          carrierCode: selectedService.carrierCode,
          serviceCode: selectedService.serviceCode,
          packageCode: packageInfo.packageCode,
          shipDate: new Date().toISOString(),
          shipmentCost: {
            currency: "USD",
            amount: selectedService.rate,
          },
        };

        setShippingLabel(mockLabel);
        setStep("complete");

        // Update order status to SHIPPED
        await updateOrderStatus();
      }
    } catch (error) {
      console.error("Failed to create shipping label:", error);
    }
    setIsCreatingLabel(false);
  };

  const updateOrderStatus = async () => {
    try {
      await fetch(`/api/orders/${order?.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SHIPPED" }),
      });
    } catch (error) {
      console.error("Failed to update order status:", error);
    }
  };

  const downloadLabel = () => {
    if (shippingLabel) {
      window.open(shippingLabel.labelUrl, "_blank");
    }
  };

  const printLabel = () => {
    if (shippingLabel) {
      window.print();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Package className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="text-gray-600">Order not found</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Button variant="ghost" onClick={() => window.history.back()}>
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back
              </Button>
              <div className="ml-4">
                <h1 className="text-2xl font-bold text-gray-900">
                  Create Shipping Label
                </h1>
                <p className="text-sm text-gray-600">
                  Order {order.orderNumber}
                </p>
              </div>
            </div>
            <Badge
              className={
                order.status === "PACKED"
                  ? "bg-yellow-100 text-yellow-800"
                  : order.status === "SHIPPED"
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-100 text-gray-800"
              }
            >
              {order.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-center space-x-8">
            {[
              { key: "review", label: "Review Order", icon: Package },
              { key: "rates", label: "Select Service", icon: Truck },
              { key: "confirm", label: "Confirm Details", icon: CheckCircle },
              { key: "complete", label: "Label Created", icon: Printer },
            ].map((stepItem, index) => {
              const Icon = stepItem.icon;
              const isActive = step === stepItem.key;
              const isCompleted =
                ["review", "rates", "confirm"].indexOf(step) >
                ["review", "rates", "confirm"].indexOf(stepItem.key);

              return (
                <div key={stepItem.key} className="flex items-center">
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full ${
                      isActive
                        ? "bg-blue-600 text-white"
                        : isCompleted
                        ? "bg-green-600 text-white"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span
                    className={`ml-2 text-sm font-medium ${
                      isActive
                        ? "text-blue-600"
                        : isCompleted
                        ? "text-green-600"
                        : "text-gray-500"
                    }`}
                  >
                    {stepItem.label}
                  </span>
                  {index < 3 && (
                    <div
                      className={`w-16 h-0.5 mx-4 ${
                        isCompleted ? "bg-green-600" : "bg-gray-200"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Order Summary - Always Visible */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  Customer Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="font-medium">{order.customer.name}</div>
                  <div className="text-sm text-gray-600">
                    {order.customer.email}
                  </div>
                  {order.customer.phone && (
                    <div className="text-sm text-gray-600">
                      {order.customer.phone}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MapPin className="w-5 h-5 mr-2" />
                  Shipping Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-1">
                  <div className="font-medium">
                    {order.shippingAddress.name}
                  </div>
                  {order.shippingAddress.company && (
                    <div>{order.shippingAddress.company}</div>
                  )}
                  <div>{order.shippingAddress.addressLine1}</div>
                  {order.shippingAddress.addressLine2 && (
                    <div>{order.shippingAddress.addressLine2}</div>
                  )}
                  <div>
                    {order.shippingAddress.city},{" "}
                    {order.shippingAddress.stateProvince}{" "}
                    {order.shippingAddress.postalCode}
                  </div>
                  <div>{order.shippingAddress.countryCode}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Package className="w-5 h-5 mr-2" />
                  Order Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-start text-sm"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{item.productName}</div>
                        <div className="text-gray-600">
                          SKU: {item.productSku}
                        </div>
                        <div className="text-gray-600">
                          Qty: {item.quantity} × ${item.value}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          ${(item.quantity * item.value).toFixed(2)}
                        </div>
                        <div className="text-gray-600">
                          {(item.quantity * item.weight).toFixed(2)} lbs
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="border-t pt-3 flex justify-between font-medium">
                    <span>Total:</span>
                    <div className="text-right">
                      <div>${order.totalValue.toFixed(2)}</div>
                      <div className="text-sm text-gray-600">
                        {order.totalWeight.toFixed(2)} lbs
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-2">
            {/* Step 1: Review Order & Package Info */}
            {step === "review" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Box className="w-5 h-5 mr-2" />
                    Package Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Package Type
                      </label>
                      <select
                        value={packageInfo.packageCode}
                        onChange={(e) =>
                          setPackageInfo((prev) => ({
                            ...prev,
                            packageCode: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="package">Package</option>
                        <option value="flat_rate_envelope">
                          Flat Rate Envelope
                        </option>
                        <option value="flat_rate_legal_envelope">
                          Flat Rate Legal Envelope
                        </option>
                        <option value="flat_rate_padded_envelope">
                          Flat Rate Padded Envelope
                        </option>
                        <option value="small_flat_rate_box">
                          Small Flat Rate Box
                        </option>
                        <option value="medium_flat_rate_box">
                          Medium Flat Rate Box
                        </option>
                        <option value="large_flat_rate_box">
                          Large Flat Rate Box
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        <Scale className="w-4 h-4 inline mr-1" />
                        Weight (lbs)
                      </label>
                      <Input
                        type="number"
                        step="0.1"
                        value={packageInfo.weight}
                        onChange={(e) =>
                          setPackageInfo((prev) => ({
                            ...prev,
                            weight: parseFloat(e.target.value) || 0,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-4">
                      Dimensions (inches)
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Length
                        </label>
                        <Input
                          type="number"
                          value={packageInfo.dimensions.length}
                          onChange={(e) =>
                            setPackageInfo((prev) => ({
                              ...prev,
                              dimensions: {
                                ...prev.dimensions,
                                length: parseFloat(e.target.value) || 0,
                              },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Width
                        </label>
                        <Input
                          type="number"
                          value={packageInfo.dimensions.width}
                          onChange={(e) =>
                            setPackageInfo((prev) => ({
                              ...prev,
                              dimensions: {
                                ...prev.dimensions,
                                width: parseFloat(e.target.value) || 0,
                              },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Height
                        </label>
                        <Input
                          type="number"
                          value={packageInfo.dimensions.height}
                          onChange={(e) =>
                            setPackageInfo((prev) => ({
                              ...prev,
                              dimensions: {
                                ...prev.dimensions,
                                height: parseFloat(e.target.value) || 0,
                              },
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={getRates}
                      disabled={isLoadingRates}
                      className="px-8"
                    >
                      {isLoadingRates ? (
                        <>
                          <Clock className="w-4 h-4 mr-2 animate-spin" />
                          Getting Rates...
                        </>
                      ) : (
                        <>
                          <Truck className="w-4 h-4 mr-2" />
                          Get Shipping Rates
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Select Shipping Service */}
            {step === "rates" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Truck className="w-5 h-5 mr-2" />
                    Select Shipping Service
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {shippingServices.map((service) => (
                      <div
                        key={service.serviceCode}
                        className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                          selectedService?.serviceCode === service.serviceCode
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                        onClick={() => setSelectedService(service)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <input
                              type="radio"
                              name="shippingService"
                              checked={
                                selectedService?.serviceCode ===
                                service.serviceCode
                              }
                              onChange={() => setSelectedService(service)}
                              className="mr-3"
                            />
                            <div>
                              <div className="font-medium">
                                {service.serviceName}
                              </div>
                              <div className="text-sm text-gray-600">
                                {service.carrierName}
                              </div>
                              <div className="text-sm text-gray-600">
                                {service.estimatedDays}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold">
                              ${service.rate.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between mt-6">
                    <Button variant="outline" onClick={() => setStep("review")}>
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                    <Button
                      onClick={() => setStep("confirm")}
                      disabled={!selectedService}
                    >
                      Continue
                      <CheckCircle className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 3: Confirm Details */}
            {step === "confirm" && selectedService && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Confirm Shipping Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-background p-4 rounded-lg">
                    <h3 className="font-medium mb-3">Selected Service</h3>
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">
                          {selectedService.serviceName}
                        </div>
                        <div className="text-sm text-gray-600">
                          {selectedService.carrierName}
                        </div>
                        <div className="text-sm text-gray-600">
                          {selectedService.estimatedDays}
                        </div>
                      </div>
                      <div className="text-xl font-bold">
                        ${selectedService.rate.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="bg-background p-4 rounded-lg">
                    <h3 className="font-medium mb-3">Package Details</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Type:</span>
                        <span className="ml-2 font-medium">
                          {packageInfo.packageCode}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Weight:</span>
                        <span className="ml-2 font-medium">
                          {packageInfo.weight} lbs
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-600">Dimensions:</span>
                        <span className="ml-2 font-medium">
                          {packageInfo.dimensions.length} ×{" "}
                          {packageInfo.dimensions.width} ×{" "}
                          {packageInfo.dimensions.height} inches
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                    <div className="flex items-start">
                      <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
                      <div className="text-sm text-yellow-800">
                        <p className="font-medium">
                          Ready to create shipping label
                        </p>
                        <p>
                          This will create a shipping label and update the order
                          status to SHIPPED. This action cannot be undone.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setStep("rates")}>
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                    <Button
                      onClick={createShippingLabel}
                      disabled={isCreatingLabel}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isCreatingLabel ? (
                        <>
                          <Clock className="w-4 h-4 mr-2 animate-spin" />
                          Creating Label...
                        </>
                      ) : (
                        <>
                          <Printer className="w-4 h-4 mr-2" />
                          Create Shipping Label
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 4: Label Created */}
            {step === "complete" && shippingLabel && (
              <div className="space-y-6">
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                      <h2 className="text-2xl font-bold text-green-800 mb-2">
                        Shipping Label Created!
                      </h2>
                      <p className="text-green-700 mb-4">
                        Your shipping label has been created and the order has
                        been marked as shipped.
                      </p>
                      <div className="bg-white p-4 rounded-lg inline-block">
                        <div className="text-sm text-gray-600">
                          Tracking Number:
                        </div>
                        <div className="text-lg font-mono font-bold text-gray-900">
                          {shippingLabel.trackingNumber}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Shipping Label Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Label ID:</span>
                        <span className="ml-2 font-medium">
                          {shippingLabel.labelId}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Carrier:</span>
                        <span className="ml-2 font-medium">
                          {shippingLabel.carrierCode.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Service:</span>
                        <span className="ml-2 font-medium">
                          {selectedService?.serviceName}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Cost:</span>
                        <span className="ml-2 font-medium">
                          ${shippingLabel.shipmentCost.amount.toFixed(2)}{" "}
                          {shippingLabel.shipmentCost.currency}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Ship Date:</span>
                        <span className="ml-2 font-medium">
                          {new Date(
                            shippingLabel.shipDate
                          ).toLocaleDateString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Format:</span>
                        <span className="ml-2 font-medium">
                          {shippingLabel.labelFormat}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-4 mt-6">
                      <Button onClick={downloadLabel} className="flex-1">
                        <Download className="w-4 h-4 mr-2" />
                        Download Label
                      </Button>
                      <Button
                        onClick={printLabel}
                        variant="outline"
                        className="flex-1"
                      >
                        <Printer className="w-4 h-4 mr-2" />
                        Print Label
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-center space-x-4">
                  <Button
                    variant="outline"
                    onClick={() =>
                      (window.location.href = "/orders/management")
                    }
                  >
                    Return to Orders
                  </Button>
                  <Button
                    onClick={() =>
                      (window.location.href = "/dashboard/shipping")
                    }
                  >
                    Shipping Dashboard
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
