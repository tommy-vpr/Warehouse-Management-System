"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  Truck,
  Download,
  ExternalLink,
  ArrowLeft,
  Copy,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CarrierBadge } from "@/components/CarrierBadge";

interface PackageItem {
  id: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: string;
}

interface ShippingPackage {
  id: string;
  carrierCode: string;
  serviceCode: string;
  packageCode: string;
  trackingNumber: string;
  labelUrl: string;
  cost: string;
  currency: string;
  weight: number;
  dimensions: {
    length: number;
    width: number;
    height: number;
    unit: string;
  };
  createdAt: string;
  items: PackageItem[];
}

interface TrackingInfo {
  order: {
    id: string;
    orderNumber: string;
    customerName: string;
    status: string;
    shippedAt?: string;
  };
  packages: ShippingPackage[];
  totalCost: number;
  totalWeight: number;
}

export default function TrackingPage(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [trackingInfo, setTrackingInfo] = useState<TrackingInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedTracking, setCopiedTracking] = useState<string | null>(null);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  useEffect(() => {
    loadTrackingInfo();
  }, [id]);

  const loadTrackingInfo = async () => {
    try {
      setError("");
      const response = await fetch(`/api/shipping/tracking/${id}`);

      if (!response.ok) {
        throw new Error(`Failed to load tracking info: ${response.status}`);
      }

      const data = await response.json();
      setTrackingInfo(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string, trackingNumber: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTracking(trackingNumber);
      setTimeout(() => setCopiedTracking(null), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  };

  const getCarrierName = (carrierCode: string) => {
    const carriers: { [key: string]: string } = {
      ups: "UPS",
      fedex: "FedEx",
      stamps_com: "USPS",
      usps: "USPS",
      dhl: "DHL",
    };
    return carriers[carrierCode] || carrierCode.toUpperCase();
  };

  const getCarrierTrackingUrl = (
    carrierCode: string,
    trackingNumber: string
  ) => {
    const urls: { [key: string]: string } = {
      ups: `https://www.ups.com/track?track=yes&trackNums=${trackingNumber}`,
      fedex: `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
      stamps_com: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
      usps: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
      dhl: `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${trackingNumber}`,
    };
    return urls[carrierCode];
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600 dark:text-gray-200">
            Loading shipment details...
          </p>
        </div>
      </div>
    );
  }

  if (error || !trackingInfo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Error Loading Tracking Info
          </h2>
          <p className="text-gray-600 mb-4">
            {error || "Tracking information not found"}
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={loadTrackingInfo}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
            <Link href="/dashboard/orders">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Orders
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Link href="/dashboard/orders">
              <Button variant="ghost" className="mr-4 cursor-pointer">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Tracking Information
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Order {trackingInfo.order.orderNumber} -{" "}
                {trackingInfo.order.customerName}
              </p>
            </div>
          </div>
          <Badge className="bg-green-100 text-green-800 dark:bg-green-500 dark:text-gray-800">
            {trackingInfo.packages.length} Package
            {trackingInfo.packages.length > 1 ? "s" : ""}
          </Badge>
        </div>

        {/* Summary Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center text-md">
              <Truck className="w-5 h-5 mr-2" />
              Shipment Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500">Total Cost</p>
                <p className="text-md font-semibold">
                  ${trackingInfo.totalCost.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Weight</p>
                <p className="text-md font-semibold">
                  {trackingInfo.totalWeight.toFixed(1)} lbs
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Packages</p>
                <p className="text-md font-semibold">
                  {trackingInfo.packages.length}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Shipped Date</p>
                <p className="text-md font-semibold">
                  {trackingInfo.order.shippedAt
                    ? new Date(
                        trackingInfo.order.shippedAt
                      ).toLocaleDateString()
                    : "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Packages List */}
        <div className="space-y-4">
          {trackingInfo.packages.map((pkg, index) => (
            <Card key={pkg.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-md">
                  <span className="flex items-center">
                    <Package className="w-5 h-5 mr-2" />
                    Package {index + 1}
                  </span>
                  <CarrierBadge carrierCode={pkg.carrierCode} />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column - Tracking & Package Info */}
                  <div className="space-y-4">
                    {/* Tracking Details */}
                    <div>
                      <h4 className="font-medium mb-3">Tracking Details</h4>
                      <div className="flex items-center justify-between p-3 bg-gray-100 dark:bg-zinc-900 rounded-md">
                        <div>
                          <p className="text-xs text-gray-500">
                            Tracking Number
                          </p>
                          <p className="font-mono">{pkg.trackingNumber}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              copyToClipboard(
                                pkg.trackingNumber,
                                pkg.trackingNumber
                              )
                            }
                          >
                            {copiedTracking === pkg.trackingNumber ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                          {getCarrierTrackingUrl(
                            pkg.carrierCode,
                            pkg.trackingNumber
                          ) && (
                            <Button
                              size="sm"
                              onClick={() =>
                                window.open(
                                  getCarrierTrackingUrl(
                                    pkg.carrierCode,
                                    pkg.trackingNumber
                                  ),
                                  "_blank"
                                )
                              }
                            >
                              <ExternalLink className="w-4 h-4 mr-1" />
                              Track
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Package Specs */}
                    <div>
                      <h4 className="font-medium mb-3">
                        Package Specifications
                      </h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-gray-500 text-xs">Service</p>
                          <p className="font-medium">
                            {pkg.serviceCode.replace(/_/g, " ").toUpperCase()}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Cost</p>
                          <p className="font-medium">
                            ${pkg.cost} {pkg.currency}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Weight</p>
                          <p className="font-medium">{pkg.weight} lbs</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Dimensions</p>
                          <p className="font-medium">
                            {pkg.dimensions.length} × {pkg.dimensions.width} ×{" "}
                            {pkg.dimensions.height} {pkg.dimensions.unit}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* ✅ Package Contents */}
                    <div>
                      <h4 className="font-medium mb-3">Package Items</h4>
                      <div className="space-y-2">
                        {pkg.items && pkg.items.length > 0 ? (
                          pkg.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex justify-between items-center p-2 border border-gray-200 dark:border-zinc-700 rounded text-sm"
                            >
                              <div className="flex-1">
                                <p className="font-medium">
                                  {item.productName}
                                </p>
                                <p className="text-xs text-blue-500">
                                  SKU: {item.sku}
                                </p>
                              </div>
                              <div className="text-right ml-4">
                                <p className="font-medium">×{item.quantity}</p>
                                {/* <p className="text-xs text-gray-500">
                                  ${item.unitPrice}
                                </p> */}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-500 italic p-2">
                            No items recorded
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-xs text-gray-500 pt-2 border-t">
                      Created: {new Date(pkg.createdAt).toLocaleString()}
                    </div>
                  </div>

                  {/* Right Column - Actions */}
                  <div>
                    <h4 className="font-medium mb-3">Actions</h4>
                    <div className="space-y-3">
                      <Button
                        onClick={() => window.open(pkg.labelUrl, "_blank")}
                        className="w-full"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Shipping Label
                      </Button>

                      {getCarrierTrackingUrl(
                        pkg.carrierCode,
                        pkg.trackingNumber
                      ) && (
                        <Button
                          variant="outline"
                          onClick={() =>
                            window.open(
                              getCarrierTrackingUrl(
                                pkg.carrierCode,
                                pkg.trackingNumber
                              ),
                              "_blank"
                            )
                          }
                          className="w-full"
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Track on {getCarrierName(pkg.carrierCode)} Website
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        onClick={() =>
                          copyToClipboard(
                            pkg.trackingNumber,
                            pkg.trackingNumber
                          )
                        }
                        className="w-full"
                      >
                        {copiedTracking === pkg.trackingNumber ? (
                          <>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-2" />
                            Copy Tracking Number
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* All Labels Download */}
        {trackingInfo.packages.length > 1 && (
          <Card className="mt-6">
            <CardContent className="p-6">
              <div className="text-center">
                <h3 className="font-medium mb-2 text-green-400">
                  Download All Labels
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                  Get all {trackingInfo.packages.length} shipping labels at once
                </p>
                <Button
                  disabled={isDownloadingAll}
                  onClick={async () => {
                    try {
                      setIsDownloadingAll(true);
                      const res = await fetch(
                        `/api/shipping/tracking/${trackingInfo.order.id}/labels`
                      );
                      if (!res.ok) throw new Error("Failed to download labels");

                      const blob = await res.blob();
                      const url = window.URL.createObjectURL(blob);

                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `${trackingInfo.order.orderNumber}-labels.pdf`;
                      a.click();

                      window.URL.revokeObjectURL(url);
                    } catch (err) {
                      console.error(err);
                    } finally {
                      setIsDownloadingAll(false);
                    }
                  }}
                >
                  {isDownloadingAll ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Download All Labels
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// "use client";

// import React, { useState, useEffect } from "react";
// import { Button } from "@/components/ui/button";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Badge } from "@/components/ui/badge";
// import {
//   Package,
//   Truck,
//   Download,
//   ExternalLink,
//   ArrowLeft,
//   Copy,
//   CheckCircle,
//   AlertTriangle,
//   RefreshCw,
// } from "lucide-react";
// import { useParams } from "next/navigation";
// import Link from "next/link";
// import { CarrierBadge } from "@/components/CarrierBadge";

// interface PackageItem {
//   id: string;
//   productName: string;
//   sku: string;
//   quantity: number;
//   unitPrice: string;
// }

// interface ShippingPackage {
//   id: string;
//   carrierCode: string;
//   serviceCode: string;
//   packageCode: string;
//   trackingNumber: string;
//   labelUrl: string;
//   cost: string;
//   currency: string;
//   weight: number;
//   dimensions: {
//     length: number;
//     width: number;
//     height: number;
//     unit: string;
//   };
//   createdAt: string;
//   items: PackageItem[]; // ✅ NEW
// }

// interface TrackingInfo {
//   order: {
//     id: string;
//     orderNumber: string;
//     customerName: string;
//     status: string;
//     shippedAt?: string;
//   };
//   packages: ShippingPackage[];
//   totalCost: number;
//   totalWeight: number;
// }

// export default function TrackingPage() {
//   const params = useParams<{ id: string }>();
//   const id = params.id;

//   const [trackingInfo, setTrackingInfo] = useState<TrackingInfo | null>(null);
//   const [isLoading, setIsLoading] = useState(true);
//   const [error, setError] = useState("");
//   const [copiedTracking, setCopiedTracking] = useState<string | null>(null);
//   const [isDownloadingAll, setIsDownloadingAll] = useState(false);

//   useEffect(() => {
//     loadTrackingInfo();
//   }, [id]);

//   console.log(trackingInfo);

//   const loadTrackingInfo = async () => {
//     try {
//       setError("");
//       const response = await fetch(`/api/shipping/tracking/${id}`);

//       if (!response.ok) {
//         throw new Error(`Failed to load tracking info: ${response.status}`);
//       }

//       const data = await response.json();
//       setTrackingInfo(data);
//     } catch (err) {
//       const message = err instanceof Error ? err.message : "Unknown error";
//       setError(message);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const copyToClipboard = async (text: string, trackingNumber: string) => {
//     try {
//       await navigator.clipboard.writeText(text);
//       setCopiedTracking(trackingNumber);
//       setTimeout(() => setCopiedTracking(null), 2000);
//     } catch (err) {
//       console.error("Failed to copy to clipboard:", err);
//     }
//   };

//   const getCarrierName = (carrierCode: string) => {
//     const carriers: { [key: string]: string } = {
//       ups: "UPS",
//       fedex: "FedEx",
//       stamps_com: "USPS",
//       usps: "USPS",
//       dhl: "DHL",
//     };
//     return carriers[carrierCode] || carrierCode.toUpperCase();
//   };

//   const getCarrierTrackingUrl = (
//     carrierCode: string,
//     trackingNumber: string
//   ) => {
//     const urls: { [key: string]: string } = {
//       ups: `https://www.ups.com/track?track=yes&trackNums=${trackingNumber}`,
//       fedex: `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
//       stamps_com: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
//       usps: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
//       dhl: `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${trackingNumber}`,
//     };
//     return urls[carrierCode];
//   };

//   if (isLoading) {
//     return (
//       <div className="min-h-screen bg-background flex items-center justify-center p-4">
//         <div className="text-center">
//           <Package className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-pulse" />
//           <p className="text-gray-600 dark:text-gray-400">
//             Loading tracking information...
//           </p>
//         </div>
//       </div>
//     );
//   }

//   if (error || !trackingInfo) {
//     return (
//       <div className="min-h-screen bg-background flex items-center justify-center p-4">
//         <div className="text-center">
//           <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
//           <h2 className="text-xl font-semibold text-gray-900 mb-2">
//             Error Loading Tracking Info
//           </h2>
//           <p className="text-gray-600 mb-4">
//             {error || "Tracking information not found"}
//           </p>
//           <div className="flex gap-3 justify-center">
//             <Button onClick={loadTrackingInfo}>
//               <RefreshCw className="w-4 h-4 mr-2" />
//               Retry
//             </Button>
//             <Link href="/dashboard/orders">
//               <Button variant="outline">
//                 <ArrowLeft className="w-4 h-4 mr-2" />
//                 Back to Orders
//               </Button>
//             </Link>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-background p-6">
//       <div className="max-w-6xl mx-auto">
//         {/* Header */}
//         <div className="flex items-center justify-between mb-6">
//           <div className="flex items-center">
//             <Link href="/dashboard/orders">
//               <Button variant="ghost" className="mr-4 cursor-pointer">
//                 <ArrowLeft className="w-4 h-4" />
//               </Button>
//             </Link>
//             <div>
//               <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
//                 Tracking Information
//               </h1>
//               <p className="text-gray-600 dark:text-gray-400">
//                 Order {trackingInfo.order.orderNumber} -{" "}
//                 {trackingInfo.order.customerName}
//               </p>
//             </div>
//           </div>
//           <Badge className="bg-green-100 text-green-800 dark:bg-green-500 dark:text-gray-800">
//             {trackingInfo.packages.length} Package
//             {trackingInfo.packages.length > 1 ? "s" : ""}
//           </Badge>
//         </div>

//         {/* Summary Card */}
//         <Card className="mb-6">
//           <CardHeader>
//             <CardTitle className="flex items-center text-md">
//               <Truck className="w-5 h-5 mr-2" />
//               Shipment Summary
//             </CardTitle>
//           </CardHeader>
//           <CardContent>
//             <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
//               <div>
//                 <p className="text-xs text-gray-500">Total Cost</p>
//                 <p className="text-md font-semibold">
//                   ${trackingInfo.totalCost.toFixed(2)}
//                 </p>
//               </div>
//               <div>
//                 <p className="text-xs text-gray-500">Total Weight</p>
//                 <p className="text-md font-semibold">
//                   {trackingInfo.totalWeight.toFixed(1)} lbs
//                 </p>
//               </div>
//               <div>
//                 <p className="text-xs text-gray-500">Packages</p>
//                 <p className="text-md font-semibold">
//                   {trackingInfo.packages.length}
//                 </p>
//               </div>
//               <div>
//                 <p className="text-xs text-gray-500">Shipped Date</p>
//                 <p className="text-md font-semibold">
//                   {trackingInfo.order.shippedAt
//                     ? new Date(
//                         trackingInfo.order.shippedAt
//                       ).toLocaleDateString()
//                     : "N/A"}
//                 </p>
//               </div>
//             </div>
//           </CardContent>
//         </Card>

//         {/* Packages List */}
//         <div className="space-y-4">
//           {trackingInfo.packages.map((pkg, index) => (
//             <Card key={pkg.id}>
//               <CardHeader>
//                 <CardTitle className="flex items-center justify-between text-md">
//                   <span className="flex items-center">
//                     <Package className="w-5 h-5 mr-2" />
//                     Package {index + 1}
//                   </span>
//                   {/* Carrier badge */}
//                   <CarrierBadge carrierCode={pkg.carrierCode} />
//                 </CardTitle>
//               </CardHeader>
//               <CardContent>
//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                   {/* Tracking Information */}
//                   <div>
//                     <h4 className="font-medium mb-3">Tracking Details</h4>
//                     <div className="space-y-3">
//                       <div className="flex items-center justify-between p-3 bg-gray-100 dark:bg-zinc-900 rounded-md">
//                         <div>
//                           <p className="text-xs text-gray-500">
//                             Tracking Number
//                           </p>
//                           <p className="font-mono">{pkg.trackingNumber}</p>
//                         </div>
//                         <div className="flex gap-2">
//                           <Button
//                             className="cursor-pointer"
//                             variant="outline"
//                             onClick={() =>
//                               copyToClipboard(
//                                 pkg.trackingNumber,
//                                 pkg.trackingNumber
//                               )
//                             }
//                           >
//                             {copiedTracking === pkg.trackingNumber ? (
//                               <CheckCircle className="w-4 h-4" />
//                             ) : (
//                               <Copy className="w-4 h-4" />
//                             )}
//                           </Button>
//                           {getCarrierTrackingUrl(
//                             pkg.carrierCode,
//                             pkg.trackingNumber
//                           ) && (
//                             <Button
//                               className="cursor-pointer"
//                               onClick={() =>
//                                 window.open(
//                                   getCarrierTrackingUrl(
//                                     pkg.carrierCode,
//                                     pkg.trackingNumber
//                                   ),
//                                   "_blank"
//                                 )
//                               }
//                             >
//                               <ExternalLink className="w-4 h-4" />
//                               Track
//                             </Button>
//                           )}
//                         </div>
//                       </div>

//                       <div className="grid grid-cols-2 gap-3 text-xs">
//                         <div>
//                           <p className="text-gray-500">Service</p>
//                           <p className="font-medium">
//                             {pkg.serviceCode.replace(/_/g, " ").toUpperCase()}
//                           </p>
//                         </div>
//                         <div>
//                           <p className="text-gray-500">Cost</p>
//                           <p className="font-medium">
//                             ${pkg.cost} {pkg.currency}
//                           </p>
//                         </div>
//                         <div>
//                           <p className="text-gray-500">Weight</p>
//                           <p className="font-medium">{pkg.weight} lbs</p>
//                         </div>
//                         <div>
//                           <p className="text-gray-500">Dimensions</p>
//                           <p className="font-medium">
//                             {pkg.dimensions.length} × {pkg.dimensions.width} ×{" "}
//                             {pkg.dimensions.height} {pkg.dimensions.unit}
//                           </p>
//                         </div>
//                       </div>

//                       {/* NEW: Package Contents */}
//                       <div>
//                         <h4 className="font-medium mb-3">Package Contents</h4>
//                         <div className="space-y-2">
//                           {pkg.items && pkg.items.length > 0 ? (
//                             pkg.items.map((item) => (
//                               <div
//                                 key={item.id}
//                                 className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm"
//                               >
//                                 <div>
//                                   <p className="font-medium">
//                                     {item.productName}
//                                   </p>
//                                   <p className="text-xs text-gray-500">
//                                     SKU: {item.sku}
//                                   </p>
//                                 </div>
//                                 <div className="text-right">
//                                   <p className="font-medium">
//                                     ×{item.quantity}
//                                   </p>
//                                   <p className="text-xs text-gray-500">
//                                     ${item.unitPrice}
//                                   </p>
//                                 </div>
//                               </div>
//                             ))
//                           ) : (
//                             <p className="text-sm text-gray-500 italic">
//                               No items recorded
//                             </p>
//                           )}
//                         </div>
//                       </div>

//                       <div>
//                         <p className="text-xs text-gray-500">Created</p>
//                         <p className="text-sm">
//                           {new Date(pkg.createdAt).toLocaleString()}
//                         </p>
//                       </div>
//                     </div>
//                   </div>

//                   {/* Actions */}
//                   <div>
//                     <h4 className="font-medium mb-3">Actions</h4>
//                     <div className="space-y-3">
//                       <Button
//                         onClick={() => window.open(pkg.labelUrl, "_blank")}
//                         className="w-full cursor-pointer"
//                       >
//                         <Download className="w-4 h-4 mr-2" />
//                         Download Shipping Label
//                       </Button>

//                       {getCarrierTrackingUrl(
//                         pkg.carrierCode,
//                         pkg.trackingNumber
//                       ) && (
//                         <Button
//                           variant="outline"
//                           onClick={() =>
//                             window.open(
//                               getCarrierTrackingUrl(
//                                 pkg.carrierCode,
//                                 pkg.trackingNumber
//                               ),
//                               "_blank"
//                             )
//                           }
//                           className="w-full cursor-pointer"
//                         >
//                           <ExternalLink className="w-4 h-4 mr-2" />
//                           Track on {getCarrierName(pkg.carrierCode)} Website
//                         </Button>
//                       )}

//                       <Button
//                         variant="outline"
//                         onClick={() =>
//                           copyToClipboard(
//                             pkg.trackingNumber,
//                             pkg.trackingNumber
//                           )
//                         }
//                         className="w-full cursor-pointer"
//                       >
//                         {copiedTracking === pkg.trackingNumber ? (
//                           <>
//                             <CheckCircle className="w-4 h-4 mr-2" />
//                             Copied!
//                           </>
//                         ) : (
//                           <>
//                             <Copy className="w-4 h-4 mr-2" />
//                             Copy Tracking Number
//                           </>
//                         )}
//                       </Button>
//                     </div>
//                   </div>
//                 </div>
//               </CardContent>
//             </Card>
//           ))}
//         </div>

//         {/* All Labels Download */}
//         {trackingInfo.packages.length > 1 && (
//           <Card className="mt-6">
//             <CardContent className="p-6">
//               <div className="text-center">
//                 <h3 className="font-medium mb-2 text-green-400">
//                   Download All Labels
//                 </h3>
//                 <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
//                   Get all {trackingInfo.packages.length} shipping labels at once
//                 </p>
//                 <Button
//                   className="cursor-pointer"
//                   disabled={isDownloadingAll}
//                   onClick={async () => {
//                     try {
//                       setIsDownloadingAll(true);
//                       const res = await fetch(
//                         `/api/shipping/tracking/${trackingInfo.order.id}/labels`
//                       );
//                       if (!res.ok) throw new Error("Failed to download labels");

//                       const blob = await res.blob();
//                       const url = window.URL.createObjectURL(blob);

//                       const a = document.createElement("a");
//                       a.href = url;
//                       a.download = `${trackingInfo.order.orderNumber}-labels.pdf`;
//                       a.click();

//                       window.URL.revokeObjectURL(url);
//                     } catch (err) {
//                       console.error(err);
//                     } finally {
//                       setIsDownloadingAll(false);
//                     }
//                   }}
//                 >
//                   {isDownloadingAll ? (
//                     <>
//                       <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
//                       Downloading...
//                     </>
//                   ) : (
//                     <>
//                       <Download className="w-4 h-4 mr-2" />
//                       Download All Labels
//                     </>
//                   )}
//                 </Button>
//               </div>
//             </CardContent>
//           </Card>
//         )}
//       </div>
//     </div>
//   );
// }
