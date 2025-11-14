// dashboard/warehouse/returns/receive/page.tsx
// Warehouse interface for receiving returned packages
// ✅ FIXED: Handles RECEIVED status by auto-redirecting to inspect

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface ReturnOrderDetails {
  id: string;
  rmaNumber: string;
  status: string;
  customerName: string;
  customerEmail: string;
  reason: string;
  reasonDetails?: string;
  order: {
    orderNumber: string;
    shippedAt: string;
  };
  items: Array<{
    id: string;
    productVariant: {
      sku: string;
      name: string;
    };
    quantityRequested: number;
    status: string;
  }>;
}

export default function WarehouseReceivingPage(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const router = useRouter();

  const [rmaInput, setRmaInput] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [returnDetails, setReturnDetails] = useState<ReturnOrderDetails | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiving, setReceiving] = useState(false);

  // Handle RMA scan/lookup
  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setReturnDetails(null);

    try {
      const response = await fetch(`/api/returns/${rmaInput}`);

      if (!response.ok) {
        throw new Error("Return not found");
      }

      const data: ReturnOrderDetails = await response.json();

      // ✅ NEW: If already received, redirect to inspection page
      if (data.status === "RECEIVED") {
        router.push(`/dashboard/warehouse/returns/inspect/${data.rmaNumber}`);
        return;
      }

      // ✅ NEW: If inspection is complete, show helpful message
      if (data.status === "INSPECTED") {
        setError(
          `This return (${data.rmaNumber}) has already been inspected. Check the returns dashboard for details.`
        );
        return;
      }

      // ✅ NEW: If completed/closed, show helpful message
      if (["COMPLETED", "CANCELLED", "REJECTED"].includes(data.status)) {
        setError(
          `This return (${
            data.rmaNumber
          }) is ${data.status.toLowerCase()} and cannot be received.`
        );
        return;
      }

      // Validate status for receiving
      if (!["APPROVED", "IN_TRANSIT"].includes(data.status)) {
        setError(
          `Cannot receive return with status: ${data.status}. Must be APPROVED or IN_TRANSIT.`
        );
        return;
      }

      setReturnDetails(data);
    } catch (err: any) {
      setError(err.message || "Failed to lookup RMA");
    } finally {
      setLoading(false);
    }
  };

  // Handle package receiving
  const handleReceive = async () => {
    if (!returnDetails) return;

    setReceiving(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/returns/${returnDetails.rmaNumber}/receive`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackingNumber: trackingNumber || undefined }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to receive package");
      }

      // Success - redirect to inspection
      router.push(
        `/dashboard/warehouse/returns/inspect/${returnDetails.rmaNumber}`
      );
    } catch (err: any) {
      setError(err.message || "Failed to receive package");
    } finally {
      setReceiving(false);
    }
  };

  // Handle barcode scanner input (typically scans with Enter key)
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && rmaInput.trim()) {
      handleLookup(e as any);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background py-4 sm:py-8 px-3 sm:px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header - Responsive Typography */}
        <div className="mb-4 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
            Receive Return Package
          </h1>
          <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Scan or enter RMA barcode to begin receiving process
          </p>
        </div>

        {/* RMA Scanner - Mobile Optimized */}
        {!returnDetails && (
          <div className="bg-white dark:bg-zinc-800/50 shadow-sm dark:shadow-zinc-900/50 rounded-lg p-4 sm:p-6 border border-gray-200 dark:border-zinc-700/50">
            <form onSubmit={handleLookup}>
              <div className="mb-4">
                <label
                  htmlFor="rmaInput"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  RMA Number or Barcode
                </label>
                {/* Stack on mobile, row on desktop */}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  <input
                    type="text"
                    id="rmaInput"
                    value={rmaInput}
                    onChange={(e) => setRmaInput(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Start receiving"
                    autoFocus
                    inputMode="none"
                    autoComplete="off"
                    className="flex-1 p-2 sm:p-2.5 rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-base sm:text-lg"
                  />
                  <button
                    type="submit"
                    disabled={loading || !rmaInput.trim()}
                    className="w-full sm:w-auto px-6 py-2 sm:py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm sm:text-base font-medium"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    ) : (
                      "Lookup"
                    )}
                  </button>
                </div>
                <p className="mt-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  E.g: RMA-2025-0001 • Already received? Will redirect to
                  inspection
                </p>
              </div>

              {error && (
                <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 p-3 sm:p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-5 w-5 text-red-400 dark:text-red-500"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-xs sm:text-sm text-red-700 dark:text-red-400">
                        {error}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </form>
          </div>
        )}

        {/* Return Details - Responsive Layout */}
        {returnDetails && (
          <div className="space-y-4 sm:space-y-6">
            {/* Package Info Card */}
            <div className="bg-white dark:bg-zinc-800/50 shadow-sm dark:shadow-zinc-900/50 rounded-lg p-4 sm:p-6 border border-gray-200 dark:border-zinc-700/50">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-4">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">
                  Return Details
                </h2>
                <span
                  className="px-3 py-1 text-xs rounded-full 
                bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 w-fit"
                >
                  {returnDetails.status}
                </span>
              </div>

              {/* Stack on mobile, 2 columns on desktop */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {/* Left Column */}
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                      RMA Number
                    </p>
                    <p className="text-base sm:text-lg font-mono font-bold text-gray-900 dark:text-gray-100 break-all">
                      {returnDetails.rmaNumber}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                      Customer
                    </p>
                    <p className="text-sm sm:text-base font-medium text-gray-900 dark:text-gray-100">
                      {returnDetails.customerName}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 break-all">
                      {returnDetails.customerEmail}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                      Original Order
                    </p>
                    <p className="text-sm sm:text-base font-medium text-gray-900 dark:text-gray-100">
                      {returnDetails.order.orderNumber}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      Shipped:{" "}
                      {new Date(
                        returnDetails.order.shippedAt
                      ).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                      Return Reason
                    </p>
                    <p className="text-sm sm:text-base font-medium text-gray-900 dark:text-gray-100">
                      {returnDetails.reason.replace(/_/g, " ")}
                    </p>
                    {returnDetails.reasonDetails && (
                      <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-400 italic">
                        "{returnDetails.reasonDetails}"
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                      Total Items Expected
                    </p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {returnDetails.items.reduce(
                        (sum, item) => sum + item.quantityRequested,
                        0
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Expected Items - Mobile Scrollable */}
            <div className="bg-white dark:bg-zinc-800/50 shadow-sm dark:shadow-zinc-900/50 rounded-lg p-4 sm:p-6 border border-gray-200 dark:border-zinc-700/50">
              <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">
                Expected Items
              </h3>
              <div className="space-y-2 sm:space-y-3">
                {returnDetails.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-zinc-900/50 rounded-lg border border-gray-200 dark:border-zinc-700 gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm sm:text-base font-medium text-gray-900 dark:text-gray-100 truncate">
                        {item.productVariant.name}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        SKU: {item.productVariant.sku}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100">
                        {item.quantityRequested}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        units
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tracking Number (Optional) */}
            <div className="bg-white dark:bg-zinc-800/50 shadow-sm dark:shadow-zinc-900/50 rounded-lg p-4 sm:p-6 border border-gray-200 dark:border-zinc-700/50">
              <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">
                Shipping Information (Optional)
              </h3>
              <div>
                <label
                  htmlFor="trackingNumber"
                  className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Tracking Number
                </label>
                <input
                  type="text"
                  id="trackingNumber"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="1Z999AA10123456784"
                  inputMode="none"
                  autoComplete="off"
                  className="block w-full rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 p-2 text-sm sm:text-base"
                />
                <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  Enter if visible on package label
                </p>
              </div>
            </div>

            {/* Actions - Stack on mobile */}
            <div className="bg-white dark:bg-zinc-800/50 shadow-sm dark:shadow-zinc-900/50 rounded-lg p-4 sm:p-6 border border-gray-200 dark:border-zinc-700/50">
              {error && (
                <div className="mb-4 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 p-3 sm:p-4">
                  <div className="text-xs sm:text-sm text-red-700 dark:text-red-400">
                    {error}
                  </div>
                </div>
              )}

              {/* Stack buttons on mobile, row on desktop */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={() => {
                    setReturnDetails(null);
                    setRmaInput("");
                    setTrackingNumber("");
                    setError(null);
                  }}
                  className="w-full sm:flex-1 px-4 py-2.5 sm:py-3 border border-gray-300 dark:border-zinc-600 rounded-md text-sm sm:text-base text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReceive}
                  disabled={receiving}
                  className="w-full sm:flex-1 px-4 py-2.5 sm:py-3 bg-green-600 text-white rounded-md hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 disabled:opacity-50 font-medium transition text-sm sm:text-base"
                >
                  {receiving ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    "Confirm Receipt & Start Inspection"
                  )}
                </button>
              </div>

              <p className="mt-3 text-xs sm:text-sm text-center text-gray-500 dark:text-gray-400">
                This will mark the package as received and open the inspection
                interface
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ========================================
//  UPDATES LATEST
// ========================================

// // dashboard/warehouse/returns/receive/page.tsx
// // Warehouse interface for receiving returned packages

// "use client";

// import { useState } from "react";
// import { useRouter } from "next/navigation";
// import { Badge } from "@/components/ui/badge";
// import { Loader2 } from "lucide-react";

// interface ReturnOrderDetails {
//   id: string;
//   rmaNumber: string;
//   status: string;
//   customerName: string;
//   customerEmail: string;
//   reason: string;
//   reasonDetails?: string;
//   order: {
//     orderNumber: string;
//     shippedAt: string;
//   };
//   items: Array<{
//     id: string;
//     productVariant: {
//       sku: string;
//       name: string;
//     };
//     quantityRequested: number;
//     status: string;
//   }>;
// }

// export default function WarehouseReceivingPage() {
//   const router = useRouter();

//   const [rmaInput, setRmaInput] = useState("");
//   const [trackingNumber, setTrackingNumber] = useState("");
//   const [returnDetails, setReturnDetails] = useState<ReturnOrderDetails | null>(
//     null
//   );
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [receiving, setReceiving] = useState(false);

//   // Handle RMA scan/lookup
//   const handleLookup = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setLoading(true);
//     setError(null);
//     setReturnDetails(null);

//     try {
//       const response = await fetch(`/api/returns/${rmaInput}`);

//       if (!response.ok) {
//         throw new Error("Return not found");
//       }

//       const data: ReturnOrderDetails = await response.json();

//       // Validate status
//       if (!["APPROVED", "IN_TRANSIT"].includes(data.status)) {
//         setError(
//           `Cannot receive return with status: ${data.status}. Must be APPROVED or IN_TRANSIT.`
//         );
//         return;
//       }

//       setReturnDetails(data);
//     } catch (err: any) {
//       setError(err.message || "Failed to lookup RMA");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Handle package receiving
//   const handleReceive = async () => {
//     if (!returnDetails) return;

//     setReceiving(true);
//     setError(null);

//     try {
//       const response = await fetch(
//         `/api/returns/${returnDetails.rmaNumber}/receive`,
//         {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({ trackingNumber: trackingNumber || undefined }),
//         }
//       );

//       if (!response.ok) {
//         throw new Error("Failed to receive package");
//       }

//       // Success - redirect to inspection
//       router.push(
//         `/dashboard/warehouse/returns/inspect/${returnDetails.rmaNumber}`
//       );
//     } catch (err: any) {
//       setError(err.message || "Failed to receive package");
//     } finally {
//       setReceiving(false);
//     }
//   };

//   // Handle barcode scanner input (typically scans with Enter key)
//   const handleKeyPress = (e: React.KeyboardEvent) => {
//     if (e.key === "Enter" && rmaInput.trim()) {
//       handleLookup(e as any);
//     }
//   };

//   return (
//     <div className="min-h-screen bg-gray-50 dark:bg-background py-4 sm:py-8 px-3 sm:px-4">
//       <div className="max-w-4xl mx-auto">
//         {/* Header - Responsive Typography */}
//         <div className="mb-4 sm:mb-8">
//           <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
//             Receive Return Package
//           </h1>
//           <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-400">
//             Scan or enter RMA barcode to begin receiving process
//           </p>
//         </div>

//         {/* RMA Scanner - Mobile Optimized */}
//         {!returnDetails && (
//           <div className="bg-white dark:bg-zinc-800/50 shadow-sm dark:shadow-zinc-900/50 rounded-lg p-4 sm:p-6 border border-gray-200 dark:border-zinc-700/50">
//             <form onSubmit={handleLookup}>
//               <div className="mb-4">
//                 <label
//                   htmlFor="rmaInput"
//                   className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
//                 >
//                   RMA Number or Barcode
//                 </label>
//                 {/* Stack on mobile, row on desktop */}
//                 <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
//                   <input
//                     type="text"
//                     id="rmaInput"
//                     value={rmaInput}
//                     onChange={(e) => setRmaInput(e.target.value)}
//                     onKeyDown={handleKeyPress}
//                     placeholder="Start receiving"
//                     autoFocus
//                     className="flex-1 p-2 sm:p-2.5 rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-base sm:text-lg"
//                   />
//                   <button
//                     type="submit"
//                     disabled={loading || !rmaInput.trim()}
//                     className="w-full sm:w-auto px-6 py-2 sm:py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm sm:text-base font-medium"
//                   >
//                     {loading ? (
//                       <Loader2 className="h-4 w-4 animate-spin" />
//                     ) : (
//                       "Lookup"
//                     )}
//                   </button>
//                 </div>
//                 <p className="mt-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
//                   E.g: RMA-2025-0001
//                 </p>
//               </div>

//               {error && (
//                 <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 p-3 sm:p-4">
//                   <div className="flex">
//                     <div className="flex-shrink-0">
//                       <svg
//                         className="h-5 w-5 text-red-400 dark:text-red-500"
//                         viewBox="0 0 20 20"
//                         fill="currentColor"
//                       >
//                         <path
//                           fillRule="evenodd"
//                           d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
//                           clipRule="evenodd"
//                         />
//                       </svg>
//                     </div>
//                     <div className="ml-3">
//                       <p className="text-xs sm:text-sm text-red-700 dark:text-red-400">
//                         {error}
//                       </p>
//                     </div>
//                   </div>
//                 </div>
//               )}
//             </form>
//           </div>
//         )}

//         {/* Return Details - Responsive Layout */}
//         {returnDetails && (
//           <div className="space-y-4 sm:space-y-6">
//             {/* Package Info Card */}
//             <div className="bg-white dark:bg-zinc-800/50 shadow-sm dark:shadow-zinc-900/50 rounded-lg p-4 sm:p-6 border border-gray-200 dark:border-zinc-700/50">
//               <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-4">
//                 <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">
//                   Return Details
//                 </h2>
//                 <span
//                   className="px-3 py-1 text-xs rounded-full
//                 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 w-fit"
//                 >
//                   {returnDetails.status}
//                 </span>
//                 {/* <Badge variant="outline">{returnDetails.status}</Badge> */}
//               </div>

//               {/* Stack on mobile, 2 columns on desktop */}
//               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
//                 {/* Left Column */}
//                 <div className="space-y-3 sm:space-y-4">
//                   <div>
//                     <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
//                       RMA Number
//                     </p>
//                     <p className="text-base sm:text-lg font-mono font-bold text-gray-900 dark:text-gray-100 break-all">
//                       {returnDetails.rmaNumber}
//                     </p>
//                   </div>

//                   <div>
//                     <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
//                       Customer
//                     </p>
//                     <p className="text-sm sm:text-base font-medium text-gray-900 dark:text-gray-100">
//                       {returnDetails.customerName}
//                     </p>
//                     <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 break-all">
//                       {returnDetails.customerEmail}
//                     </p>
//                   </div>

//                   <div>
//                     <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
//                       Original Order
//                     </p>
//                     <p className="text-sm sm:text-base font-medium text-gray-900 dark:text-gray-100">
//                       {returnDetails.order.orderNumber}
//                     </p>
//                     <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
//                       Shipped:{" "}
//                       {new Date(
//                         returnDetails.order.shippedAt
//                       ).toLocaleDateString()}
//                     </p>
//                   </div>
//                 </div>

//                 {/* Right Column */}
//                 <div className="space-y-3 sm:space-y-4">
//                   <div>
//                     <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
//                       Return Reason
//                     </p>
//                     <p className="text-sm sm:text-base font-medium text-gray-900 dark:text-gray-100">
//                       {returnDetails.reason.replace(/_/g, " ")}
//                     </p>
//                     {returnDetails.reasonDetails && (
//                       <p className="mt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-400 italic">
//                         "{returnDetails.reasonDetails}"
//                       </p>
//                     )}
//                   </div>

//                   <div>
//                     <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
//                       Total Items Expected
//                     </p>
//                     <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
//                       {returnDetails.items.reduce(
//                         (sum, item) => sum + item.quantityRequested,
//                         0
//                       )}
//                     </p>
//                   </div>
//                 </div>
//               </div>
//             </div>

//             {/* Expected Items - Mobile Scrollable */}
//             <div className="bg-white dark:bg-zinc-800/50 shadow-sm dark:shadow-zinc-900/50 rounded-lg p-4 sm:p-6 border border-gray-200 dark:border-zinc-700/50">
//               <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">
//                 Expected Items
//               </h3>
//               <div className="space-y-2 sm:space-y-3">
//                 {returnDetails.items.map((item) => (
//                   <div
//                     key={item.id}
//                     className="flex items-center justify-between p-3 bg-gray-50 dark:bg-zinc-900/50 rounded-lg border border-gray-200 dark:border-zinc-700 gap-3"
//                   >
//                     <div className="flex-1 min-w-0">
//                       <p className="text-sm sm:text-base font-medium text-gray-900 dark:text-gray-100 truncate">
//                         {item.productVariant.name}
//                       </p>
//                       <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
//                         SKU: {item.productVariant.sku}
//                       </p>
//                     </div>
//                     <div className="text-right flex-shrink-0">
//                       <p className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100">
//                         {item.quantityRequested}
//                       </p>
//                       <p className="text-xs text-gray-500 dark:text-gray-400">
//                         units
//                       </p>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             </div>

//             {/* Tracking Number (Optional) */}
//             <div className="bg-white dark:bg-zinc-800/50 shadow-sm dark:shadow-zinc-900/50 rounded-lg p-4 sm:p-6 border border-gray-200 dark:border-zinc-700/50">
//               <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">
//                 Shipping Information (Optional)
//               </h3>
//               <div>
//                 <label
//                   htmlFor="trackingNumber"
//                   className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
//                 >
//                   Tracking Number
//                 </label>
//                 <input
//                   type="text"
//                   id="trackingNumber"
//                   value={trackingNumber}
//                   onChange={(e) => setTrackingNumber(e.target.value)}
//                   placeholder="1Z999AA10123456784"
//                   className="block w-full rounded-md border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 p-2 text-sm sm:text-base"
//                 />
//                 <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
//                   Enter if visible on package label
//                 </p>
//               </div>
//             </div>

//             {/* Actions - Stack on mobile */}
//             <div className="bg-white dark:bg-zinc-800/50 shadow-sm dark:shadow-zinc-900/50 rounded-lg p-4 sm:p-6 border border-gray-200 dark:border-zinc-700/50">
//               {error && (
//                 <div className="mb-4 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 p-3 sm:p-4">
//                   <div className="text-xs sm:text-sm text-red-700 dark:text-red-400">
//                     {error}
//                   </div>
//                 </div>
//               )}

//               {/* Stack buttons on mobile, row on desktop */}
//               <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
//                 <button
//                   onClick={() => {
//                     setReturnDetails(null);
//                     setRmaInput("");
//                     setTrackingNumber("");
//                     setError(null);
//                   }}
//                   className="w-full sm:flex-1 px-4 py-2.5 sm:py-3 border border-gray-300 dark:border-zinc-600 rounded-md text-sm sm:text-base text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 font-medium transition"
//                 >
//                   Cancel
//                 </button>
//                 <button
//                   onClick={handleReceive}
//                   disabled={receiving}
//                   className="w-full sm:flex-1 px-4 py-2.5 sm:py-3 bg-green-600 text-white rounded-md hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700 disabled:opacity-50 font-medium transition text-sm sm:text-base"
//                 >
//                   {receiving ? (
//                     <Loader2 className="h-4 w-4 animate-spin" />
//                   ) : (
//                     "Confirm Receipt & Start Inspection"
//                   )}
//                 </button>
//               </div>

//               <p className="mt-3 text-xs sm:text-sm text-center text-gray-500 dark:text-gray-400">
//                 This will mark the package as received and open the inspection
//                 interface
//               </p>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// ========================================
//  UPDATES
// ========================================

// "use client";

// import { useState } from "react";
// import { useRouter } from "next/navigation";

// interface ReturnOrderDetails {
//   id: string;
//   rmaNumber: string;
//   status: string;
//   customerName: string;
//   customerEmail: string;
//   reason: string;
//   reasonDetails?: string;
//   order: {
//     orderNumber: string;
//     shippedAt: string;
//   };
//   items: Array<{
//     id: string;
//     productVariant: {
//       sku: string;
//       name: string;
//     };
//     quantityRequested: number;
//     status: string;
//   }>;
// }

// export default function WarehouseReceivingPage() {
//   const router = useRouter();

//   const [rmaInput, setRmaInput] = useState("");
//   const [trackingNumber, setTrackingNumber] = useState("");
//   const [returnDetails, setReturnDetails] = useState<ReturnOrderDetails | null>(
//     null
//   );
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [receiving, setReceiving] = useState(false);

//   // Handle RMA scan/lookup
//   const handleLookup = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setLoading(true);
//     setError(null);
//     setReturnDetails(null);

//     try {
//       const response = await fetch(`/api/returns/${rmaInput}`);

//       if (!response.ok) {
//         throw new Error("Return not found");
//       }

//       const data: ReturnOrderDetails = await response.json();

//       // Validate status
//       if (!["APPROVED", "IN_TRANSIT"].includes(data.status)) {
//         setError(
//           `Cannot receive return with status: ${data.status}. Must be APPROVED or IN_TRANSIT.`
//         );
//         return;
//       }

//       setReturnDetails(data);
//     } catch (err: any) {
//       setError(err.message || "Failed to lookup RMA");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Handle package receiving
//   const handleReceive = async () => {
//     if (!returnDetails) return;

//     setReceiving(true);
//     setError(null);

//     try {
//       const response = await fetch(
//         `/api/returns/${returnDetails.rmaNumber}/receive`,
//         {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({ trackingNumber: trackingNumber || undefined }),
//         }
//       );

//       if (!response.ok) {
//         throw new Error("Failed to receive package");
//       }

//       // Success - redirect to inspection
//       router.push(
//         `/dashboard/warehouse/returns/inspect/${returnDetails.rmaNumber}`
//       );
//     } catch (err: any) {
//       setError(err.message || "Failed to receive package");
//     } finally {
//       setReceiving(false);
//     }
//   };

//   // Handle barcode scanner input (typically scans with Enter key)
//   const handleKeyPress = (e: React.KeyboardEvent) => {
//     if (e.key === "Enter" && rmaInput.trim()) {
//       handleLookup(e as any);
//     }
//   };

//   return (
//     <div className="min-h-screen bg-gray-50 py-8 px-4">
//       <div className="max-w-4xl mx-auto">
//         {/* Header */}
//         <div className="mb-8">
//           <h1 className="text-3xl font-bold text-gray-900">
//             Receive Return Package
//           </h1>
//           <p className="mt-2 text-gray-600">
//             Scan or enter RMA barcode to begin receiving process
//           </p>
//         </div>

//         {/* RMA Scanner */}
//         {!returnDetails && (
//           <div className="bg-white shadow rounded-lg p-6">
//             <form onSubmit={handleLookup}>
//               <div className="mb-4">
//                 <label
//                   htmlFor="rmaInput"
//                   className="block text-sm font-medium text-gray-700 mb-2"
//                 >
//                   RMA Number or Barcode
//                 </label>
//                 <div className="flex space-x-3">
//                   <input
//                     type="text"
//                     id="rmaInput"
//                     value={rmaInput}
//                     onChange={(e) => setRmaInput(e.target.value)}
//                     onKeyDown={handleKeyPress}
//                     placeholder="RMA-2025-0001 or scan barcode"
//                     autoFocus
//                     className="flex-1 p-2 rounded-md border border-gray-300 focus:border-blue-500 focus:ring-blue-500 text-lg"
//                   />
//                   <button
//                     type="submit"
//                     disabled={loading || !rmaInput.trim()}
//                     className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
//                   >
//                     {loading ? "Looking up..." : "Lookup"}
//                   </button>
//                 </div>
//                 <p className="mt-2 text-sm text-gray-500">
//                   💡 Tip: Use a barcode scanner for faster input
//                 </p>
//               </div>

//               {error && (
//                 <div className="rounded-md bg-red-50 p-4">
//                   <div className="flex">
//                     <div className="flex-shrink-0">
//                       <svg
//                         className="h-5 w-5 text-red-400"
//                         viewBox="0 0 20 20"
//                         fill="currentColor"
//                       >
//                         <path
//                           fillRule="evenodd"
//                           d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
//                           clipRule="evenodd"
//                         />
//                       </svg>
//                     </div>
//                     <div className="ml-3">
//                       <p className="text-sm text-red-700">{error}</p>
//                     </div>
//                   </div>
//                 </div>
//               )}
//             </form>
//           </div>
//         )}

//         {/* Return Details */}
//         {returnDetails && (
//           <div className="space-y-6">
//             {/* Package Info Card */}
//             <div className="bg-white shadow rounded-lg p-6">
//               <div className="flex items-center justify-between mb-4">
//                 <h2 className="text-xl font-bold text-gray-900">
//                   Return Details
//                 </h2>
//                 <span className="px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-800">
//                   {returnDetails.status}
//                 </span>
//               </div>

//               <div className="grid grid-cols-2 gap-6">
//                 {/* Left Column */}
//                 <div className="space-y-4">
//                   <div>
//                     <p className="text-sm text-gray-500">RMA Number</p>
//                     <p className="text-lg font-mono font-bold text-gray-900">
//                       {returnDetails.rmaNumber}
//                     </p>
//                   </div>

//                   <div>
//                     <p className="text-sm text-gray-500">Customer</p>
//                     <p className="font-medium text-gray-900">
//                       {returnDetails.customerName}
//                     </p>
//                     <p className="text-sm text-gray-600">
//                       {returnDetails.customerEmail}
//                     </p>
//                   </div>

//                   <div>
//                     <p className="text-sm text-gray-500">Original Order</p>
//                     <p className="font-medium text-gray-900">
//                       {returnDetails.order.orderNumber}
//                     </p>
//                     <p className="text-sm text-gray-600">
//                       Shipped:{" "}
//                       {new Date(
//                         returnDetails.order.shippedAt
//                       ).toLocaleDateString()}
//                     </p>
//                   </div>
//                 </div>

//                 {/* Right Column */}
//                 <div className="space-y-4">
//                   <div>
//                     <p className="text-sm text-gray-500">Return Reason</p>
//                     <p className="font-medium text-gray-900">
//                       {returnDetails.reason.replace(/_/g, " ")}
//                     </p>
//                     {returnDetails.reasonDetails && (
//                       <p className="mt-1 text-sm text-gray-600 italic">
//                         "{returnDetails.reasonDetails}"
//                       </p>
//                     )}
//                   </div>

//                   <div>
//                     <p className="text-sm text-gray-500">
//                       Total Items Expected
//                     </p>
//                     <p className="text-2xl font-bold text-gray-900">
//                       {returnDetails.items.reduce(
//                         (sum, item) => sum + item.quantityRequested,
//                         0
//                       )}
//                     </p>
//                   </div>
//                 </div>
//               </div>
//             </div>

//             {/* Expected Items */}
//             <div className="bg-white shadow rounded-lg p-6">
//               <h3 className="text-lg font-medium text-gray-900 mb-4">
//                 Expected Items
//               </h3>
//               <div className="space-y-3">
//                 {returnDetails.items.map((item) => (
//                   <div
//                     key={item.id}
//                     className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
//                   >
//                     <div>
//                       <p className="font-medium text-gray-900">
//                         {item.productVariant.name}
//                       </p>
//                       <p className="text-sm text-gray-500">
//                         SKU: {item.productVariant.sku}
//                       </p>
//                     </div>
//                     <div className="text-right">
//                       <p className="text-lg font-bold text-gray-900">
//                         {item.quantityRequested}
//                       </p>
//                       <p className="text-xs text-gray-500">units</p>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             </div>

//             {/* Tracking Number (Optional) */}
//             <div className="bg-white shadow rounded-lg p-6">
//               <h3 className="text-lg font-medium text-gray-900 mb-4">
//                 Shipping Information (Optional)
//               </h3>
//               <div>
//                 <label
//                   htmlFor="trackingNumber"
//                   className="block text-sm font-medium text-gray-700 mb-2"
//                 >
//                   Tracking Number
//                 </label>
//                 <input
//                   type="text"
//                   id="trackingNumber"
//                   value={trackingNumber}
//                   onChange={(e) => setTrackingNumber(e.target.value)}
//                   placeholder="1Z999AA10123456784"
//                   className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
//                 />
//                 <p className="mt-1 text-sm text-gray-500">
//                   Enter if visible on package label
//                 </p>
//               </div>
//             </div>

//             {/* Actions */}
//             <div className="bg-white shadow rounded-lg p-6">
//               {error && (
//                 <div className="mb-4 rounded-md bg-red-50 p-4">
//                   <div className="text-sm text-red-700">{error}</div>
//                 </div>
//               )}

//               <div className="flex space-x-3">
//                 <button
//                   onClick={() => {
//                     setReturnDetails(null);
//                     setRmaInput("");
//                     setTrackingNumber("");
//                     setError(null);
//                   }}
//                   className="flex-1 px-4 py-3 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 font-medium"
//                 >
//                   Cancel
//                 </button>
//                 <button
//                   onClick={handleReceive}
//                   disabled={receiving}
//                   className="flex-1 px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 font-medium"
//                 >
//                   {receiving
//                     ? "Receiving..."
//                     : "✓ Confirm Receipt & Start Inspection"}
//                 </button>
//               </div>

//               <p className="mt-3 text-sm text-center text-gray-500">
//                 This will mark the package as received and open the inspection
//                 interface
//               </p>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }
