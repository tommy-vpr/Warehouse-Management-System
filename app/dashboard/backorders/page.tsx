// app/dashboard/backorders/page.tsx
"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Truck } from "lucide-react";
import { BackOrderShippingManager } from "@/components/backorders/BackOrderShippingManager";
// Import your existing back order allocation component
// import { BackOrderAllocationManager } from "@/components/backorders/BackOrderAllocationManager";
import BackOrderAllocationManager from "@/components/backorders/BackOrderAllocationManager";

export default function BackOrdersPage(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return (
    <div className="container mx-auto p-2">
      <h1 className="text-3xl font-bold mb-6">Back Order Management</h1>

      <Tabs defaultValue="allocation" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="allocation" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Allocation
          </TabsTrigger>
          <TabsTrigger value="shipping" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Shipping Labels
          </TabsTrigger>
        </TabsList>

        <TabsContent value="allocation" className="mt-6">
          {/* Your existing back order allocation UI */}
          <div className="space-y-4">
            <BackOrderAllocationManager />
            {/* Or paste your current back order allocation code here */}
          </div>
        </TabsContent>

        <TabsContent value="shipping" className="mt-6">
          <BackOrderShippingManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// // app/dashboard/backorders/page.tsx
// "use client";

// import React, { useState } from "react";
// import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// import { Button } from "@/components/ui/button";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Badge } from "@/components/ui/badge";
// import {
//   Package,
//   AlertTriangle,
//   CheckCircle,
//   Loader2,
//   Truck,
//   ClipboardList,
//   Box,
// } from "lucide-react";
// import { toast } from "@/hooks/use-toast";
// import Link from "next/link";

// interface BackOrder {
//   id: string;
//   orderId: string;
//   orderNumber: string;
//   customerName: string;
//   productVariantId: string;
//   sku: string;
//   productName: string;
//   quantityBackOrdered: number;
//   quantityFulfilled: number;
//   status:
//     | "PENDING"
//     | "ALLOCATED"
//     | "PICKING"
//     | "PICKED"
//     | "PACKED"
//     | "FULFILLED"
//     | "CANCELLED";
//   reason: string;
//   reasonDetails: string;
//   createdAt: string;
//   fulfilledAt?: string;
//   availableInventory: number;
//   canFulfill: boolean;
//   // ✅ ADD: Pick list fields
//   pickListId?: string | null;
//   pickListBatchNumber?: string | null;
//   pickListStatus?: string | null;
// }

// interface Stats {
//   pending: number;
//   allocated: number;
//   picking: number;
//   picked: number;
//   packed: number;
//   fulfilled: number;
//   canFulfillNow: number;
// }

// const fetchBackOrders = async () => {
//   const response = await fetch("/api/backorders");
//   if (!response.ok) throw new Error("Failed to fetch back orders");
//   return response.json();
// };

// const fulfillBackOrder = async (backOrderId: string) => {
//   const response = await fetch(`/api/backorders/${backOrderId}/fulfill`, {
//     method: "POST",
//   });
//   if (!response.ok) {
//     const error = await response.json();
//     throw new Error(error.message || "Failed to allocate back order");
//   }
//   return response.json();
// };

// export default function BackOrdersDashboard() {
//   const queryClient = useQueryClient();
//   const [statusFilter, setStatusFilter] = useState<string>("ALL");

//   const [loadingAction, setLoadingAction] = useState<{
//     backOrderId: string;
//     action: string;
//   } | null>(null);

//   const { data, isLoading } = useQuery({
//     queryKey: ["backorders"],
//     queryFn: fetchBackOrders,
//     refetchInterval: 30000, // Refresh every 30 seconds
//   });

//   const fulfillMutation = useMutation({
//     mutationFn: fulfillBackOrder,
//     onSuccess: () => {
//       queryClient.invalidateQueries({ queryKey: ["backorders"] });
//       toast({
//         title: "Success",
//         description: "Back order allocated successfully - ready for picking",
//         variant: "success",
//       });
//     },
//     onError: (error: Error) => {
//       toast({
//         title: "Error",
//         description: error.message,
//         variant: "destructive",
//       });
//     },
//   });

//   const backOrders: BackOrder[] = data?.backOrders || [];
//   const stats: Stats = data?.stats || {
//     pending: 0,
//     allocated: 0,
//     picking: 0,
//     picked: 0,
//     packed: 0,
//     fulfilled: 0,
//     canFulfillNow: 0,
//   };

//   // Filter back orders based on status
//   const filteredBackOrders =
//     statusFilter === "ALL"
//       ? backOrders
//       : backOrders.filter((bo) => bo.status === statusFilter);

//   const getStatusColor = (status: string) => {
//     switch (status) {
//       case "PENDING":
//         return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
//       case "ALLOCATED":
//         return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
//       case "PICKING":
//         return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
//       case "PICKED":
//         return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400";
//       case "PACKED":
//         return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
//       case "FULFILLED":
//         return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
//       case "CANCELLED":
//         return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
//       default:
//         return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
//     }
//   };

//   const getStatusIcon = (status: string) => {
//     switch (status) {
//       case "PENDING":
//         return <AlertTriangle className="w-4 h-4" />;
//       case "ALLOCATED":
//         return <CheckCircle className="w-4 h-4" />;
//       case "PICKING":
//         return <ClipboardList className="w-4 h-4" />;
//       case "PICKED":
//         return <Package className="w-4 h-4" />;
//       case "PACKED":
//         return <Box className="w-4 h-4" />;
//       case "FULFILLED":
//         return <Truck className="w-4 h-4" />;
//       default:
//         return <Package className="w-4 h-4" />;
//     }
//   };

//   const getNextAction = (backOrder: BackOrder) => {
//     switch (backOrder.status) {
//       case "PENDING":
//         if (backOrder.canFulfill) {
//           return {
//             label: "Allocate Inventory",
//             action: () => fulfillMutation.mutate(backOrder.id),
//             disabled: fulfillMutation.isPending,
//             variant: "default" as const,
//             colorClass: "bg-background",
//           };
//         }
//         return {
//           label: "Awaiting Stock",
//           action: null,
//           disabled: true,
//           variant: "secondary" as const,
//           colorClass: "bg-background",
//         };

//       case "ALLOCATED":
//         return {
//           label: "Generate Pick List",
//           action: async () => {
//             setLoadingAction({
//               backOrderId: backOrder.id,
//               action: "GENERATE_PICK",
//             });
//             try {
//               // ✅ NEW: Call /api/picking/generate directly
//               const response = await fetch("/api/picking/generate", {
//                 method: "POST",
//                 headers: { "Content-Type": "application/json" },
//                 body: JSON.stringify({
//                   orderIds: [backOrder.orderId], // ✅ Generate for this specific order
//                   pickingStrategy: "SINGLE",
//                   maxItems: 100,
//                 }),
//               });

//               if (!response.ok) {
//                 const errorData = await response.json();
//                 throw new Error(
//                   errorData.error || "Failed to generate pick list"
//                 );
//               }

//               const result = await response.json();

//               toast({
//                 title: "Success",
//                 description: `Pick list ${result.pickList.batchNumber} generated with ${result.pickList.totalItems} items`,
//                 variant: "success",
//               });

//               queryClient.invalidateQueries({ queryKey: ["backorders"] });
//             } catch (error) {
//               console.error("Generate pick list error:", error);
//               toast({
//                 title: "Error",
//                 description:
//                   error instanceof Error
//                     ? error.message
//                     : "Failed to generate pick list",
//                 variant: "destructive",
//               });
//             } finally {
//               setLoadingAction(null);
//             }
//           },
//           disabled: false,
//           variant: "default" as const,
//           isAction: true,
//           actionType: "GENERATE_PICK",
//         };

//       case "PICKING":
//         return {
//           label: backOrder.pickListId ? "Pick Items" : "Generate Pick List",
//           action: backOrder.pickListId
//             ? `/dashboard/picking/mobile/${backOrder.pickListId}`
//             : async () => {
//                 setLoadingAction({
//                   backOrderId: backOrder.id,
//                   action: "GENERATE_PICK",
//                 });
//                 try {
//                   // ✅ NEW: Call /api/picking/generate directly
//                   const response = await fetch("/api/picking/generate", {
//                     method: "POST",
//                     headers: { "Content-Type": "application/json" },
//                     body: JSON.stringify({
//                       orderIds: [backOrder.orderId],
//                       pickingStrategy: "SINGLE",
//                       maxItems: 100,
//                     }),
//                   });

//                   if (!response.ok) {
//                     const errorData = await response.json();
//                     throw new Error(
//                       errorData.error || "Failed to generate pick list"
//                     );
//                   }

//                   const result = await response.json();

//                   toast({
//                     title: "Success",
//                     description: `Pick list ${result.pickList.batchNumber} generated with ${result.pickList.totalItems} items`,
//                     variant: "success",
//                   });

//                   queryClient.invalidateQueries({ queryKey: ["backorders"] });
//                 } catch (error) {
//                   console.error("Generate pick list error:", error);
//                   toast({
//                     title: "Error",
//                     description:
//                       error instanceof Error
//                         ? error.message
//                         : "Failed to generate pick list",
//                     variant: "destructive",
//                   });
//                 } finally {
//                   setLoadingAction(null);
//                 }
//               },
//           disabled: false,
//           colorClass: "bg-purple-600 hover:bg-purple-700 text-white",
//           isLink: !!backOrder.pickListId,
//           isAction: !backOrder.pickListId,
//           actionType: "PICK",
//         };

//       case "PICKED":
//         return {
//           label: "Pack Order",
//           action: `/dashboard/packing/pack/${backOrder.orderId}`,
//           disabled: false,
//           colorClass: "bg-background",
//           isLink: true,
//         };

//       case "PACKED":
//         return {
//           label: "Create Label",
//           // action: `/dashboard/shipping/create-label/${backOrder.orderId}`,
//           action: `/dashboard/packing/pack/${backOrder.orderId}`,
//           disabled: false,
//           colorClass: "bg-background",
//           isLink: true,
//         };

//       case "FULFILLED":
//         return {
//           label: "View Order",
//           action: `/dashboard/orders/${backOrder.orderId}`,
//           disabled: false,
//           colorClass: "bg-background",
//           isLink: true,
//         };

//       default:
//         return {
//           label: "View Order",
//           action: `/dashboard/orders/${backOrder.orderId}`,
//           disabled: false,
//           colorClass: "bg-background",
//           isLink: true,
//         };
//     }
//   };

//   if (isLoading) {
//     return (
//       <div className="flex items-center justify-center min-h-screen">
//         <Loader2 className="w-8 h-8 animate-spin" />
//       </div>
//     );
//   }

//   // ✅ NEW: Helper to check if action is loading
//   const isActionLoading = (backOrderId: string, actionType: string) => {
//     return (
//       loadingAction?.backOrderId === backOrderId &&
//       loadingAction?.action === actionType
//     );
//   };

//   return (
//     <div className="min-h-screen bg-background p-6">
//       <div className="max-w-7xl mx-auto">
//         {/* Header */}
//         <div className="mb-6">
//           <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
//             Back Orders
//           </h1>
//           <p className="text-gray-600 dark:text-gray-400">
//             Track and manage back orders through fulfillment lifecycle
//           </p>
//         </div>

//         {/* Stats Cards */}
//         <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
//           <Card
//             className="cursor-pointer hover:shadow-md transition-shadow"
//             onClick={() => setStatusFilter("PENDING")}
//           >
//             <CardContent className="p-4">
//               <div className="flex items-center justify-between">
//                 <div>
//                   <p className="text-xs text-gray-600 dark:text-gray-400">
//                     Pending
//                   </p>
//                   <p className="text-2xl font-bold text-yellow-600">
//                     {stats.pending}
//                   </p>
//                 </div>
//                 <AlertTriangle className="w-6 h-6 text-yellow-500" />
//               </div>
//             </CardContent>
//           </Card>

//           <Card
//             className="cursor-pointer hover:shadow-md transition-shadow"
//             onClick={() => setStatusFilter("ALLOCATED")}
//           >
//             <CardContent className="p-4">
//               <div className="flex items-center justify-between">
//                 <div>
//                   <p className="text-xs text-gray-600 dark:text-gray-400">
//                     Allocated
//                   </p>
//                   <p className="text-2xl font-bold text-blue-600">
//                     {stats.allocated}
//                   </p>
//                 </div>
//                 <CheckCircle className="w-6 h-6 text-blue-500" />
//               </div>
//             </CardContent>
//           </Card>

//           <Card
//             className="cursor-pointer hover:shadow-md transition-shadow"
//             onClick={() => setStatusFilter("PICKING")}
//           >
//             <CardContent className="p-4">
//               <div className="flex items-center justify-between">
//                 <div>
//                   <p className="text-xs text-gray-600 dark:text-gray-400">
//                     Picking
//                   </p>
//                   <p className="text-2xl font-bold text-purple-600">
//                     {stats.picking}
//                   </p>
//                 </div>
//                 <ClipboardList className="w-6 h-6 text-purple-500" />
//               </div>
//             </CardContent>
//           </Card>

//           <Card
//             className="cursor-pointer hover:shadow-md transition-shadow"
//             onClick={() => setStatusFilter("PICKED")}
//           >
//             <CardContent className="p-4">
//               <div className="flex items-center justify-between">
//                 <div>
//                   <p className="text-xs text-gray-600 dark:text-gray-400">
//                     Picked
//                   </p>
//                   <p className="text-2xl font-bold text-indigo-600">
//                     {stats.picked}
//                   </p>
//                 </div>
//                 <Package className="w-6 h-6 text-indigo-500" />
//               </div>
//             </CardContent>
//           </Card>

//           <Card
//             className="cursor-pointer hover:shadow-md transition-shadow"
//             onClick={() => setStatusFilter("PACKED")}
//           >
//             <CardContent className="p-4">
//               <div className="flex items-center justify-between">
//                 <div>
//                   <p className="text-xs text-gray-600 dark:text-gray-400">
//                     Packed
//                   </p>
//                   <p className="text-2xl font-bold text-orange-600">
//                     {stats.packed}
//                   </p>
//                 </div>
//                 <Box className="w-6 h-6 text-orange-500" />
//               </div>
//             </CardContent>
//           </Card>

//           <Card
//             className="cursor-pointer hover:shadow-md transition-shadow"
//             onClick={() => setStatusFilter("FULFILLED")}
//           >
//             <CardContent className="p-4">
//               <div className="flex items-center justify-between">
//                 <div>
//                   <p className="text-xs text-gray-600 dark:text-gray-400">
//                     Fulfilled
//                   </p>
//                   <p className="text-2xl font-bold text-green-600">
//                     {stats.fulfilled}
//                   </p>
//                 </div>
//                 <Truck className="w-6 h-6 text-green-500" />
//               </div>
//             </CardContent>
//           </Card>

//           <Card className="cursor-pointer hover:shadow-md transition-shadow bg-green-50 dark:bg-green-900/20">
//             <CardContent className="p-4">
//               <div className="flex items-center justify-between">
//                 <div>
//                   <p className="text-xs text-green-700 dark:text-green-400 font-medium">
//                     Can Fulfill
//                   </p>
//                   <p className="text-2xl font-bold text-green-700 dark:text-green-400">
//                     {stats.canFulfillNow}
//                   </p>
//                 </div>
//                 <CheckCircle className="w-6 h-6 text-green-600" />
//               </div>
//             </CardContent>
//           </Card>
//         </div>

//         {/* Filter Bar */}
//         <div className="flex items-center gap-4 mb-6">
//           <span className="text-sm text-gray-600 dark:text-gray-400">
//             Filter:
//           </span>
//           <select
//             value={statusFilter}
//             onChange={(e) => setStatusFilter(e.target.value)}
//             className="px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
//           >
//             <option value="ALL">All Status</option>
//             <option value="PENDING">Pending</option>
//             <option value="ALLOCATED">Allocated</option>
//             <option value="PICKING">Picking</option>
//             <option value="PICKED">Picked</option>
//             <option value="PACKED">Packed</option>
//             <option value="FULFILLED">Fulfilled</option>
//           </select>
//           {statusFilter !== "ALL" && (
//             <Button
//               variant="ghost"
//               size="sm"
//               onClick={() => setStatusFilter("ALL")}
//               className="text-xs"
//             >
//               Clear Filter
//             </Button>
//           )}
//         </div>

//         {/* Back Orders List */}
//         <Card>
//           <CardHeader>
//             <CardTitle>
//               Back Orders ({filteredBackOrders.length}
//               {statusFilter !== "ALL" && ` - ${statusFilter}`})
//             </CardTitle>
//           </CardHeader>
//           <CardContent>
//             <div className="overflow-x-auto">
//               <table className="w-full">
//                 <thead className="border-b">
//                   <tr>
//                     <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400">
//                       Order
//                     </th>
//                     <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400">
//                       Product
//                     </th>
//                     <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 dark:text-gray-400">
//                       Quantity
//                     </th>
//                     <th className="px-4 py-3 text-right text-sm font-medium text-gray-600 dark:text-gray-400">
//                       Available
//                     </th>
//                     <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400">
//                       Status
//                     </th>
//                     <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400">
//                       Created
//                     </th>
//                     <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400">
//                       Actions
//                     </th>
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y">
//                   {filteredBackOrders.map((backOrder: BackOrder) => {
//                     const nextAction = getNextAction(backOrder);
//                     const isLoading = nextAction.actionType
//                       ? isActionLoading(backOrder.id, nextAction.actionType)
//                       : false;

//                     return (
//                       <tr key={backOrder.id}>
//                         <td className="px-4 py-3">
//                           <div>
//                             <Link
//                               href={`/dashboard/orders/${backOrder.orderId}`}
//                               className="font-medium hover:underline"
//                             >
//                               {backOrder.orderNumber}
//                             </Link>
//                             <div className="text-sm text-gray-500">
//                               {backOrder.customerName}
//                             </div>
//                             {/* ✅ Show pick list if exists */}
//                             {backOrder.pickListBatchNumber && (
//                               <div className="text-xs text-blue-600 dark:text-blue-500 mt-1">
//                                 Pick List: {backOrder.pickListBatchNumber}
//                               </div>
//                             )}
//                           </div>
//                         </td>
//                         <td className="px-4 py-3">
//                           <div>
//                             <div className="font-medium">
//                               {backOrder.productName}
//                             </div>
//                             <div className="text-sm text-gray-500">
//                               {backOrder.sku}
//                             </div>
//                           </div>
//                         </td>
//                         <td className="px-4 py-3 text-right">
//                           <span className="font-semibold text-red-400">
//                             {backOrder.quantityBackOrdered -
//                               backOrder.quantityFulfilled}
//                           </span>
//                         </td>
//                         <td className="px-4 py-3 text-right">
//                           <span
//                             className={`font-semibold ${
//                               backOrder.canFulfill
//                                 ? "text-green-600"
//                                 : "text-gray-500"
//                             }`}
//                           >
//                             {backOrder.availableInventory}
//                           </span>
//                         </td>
//                         <td className="px-4 py-3">
//                           <Badge className={getStatusColor(backOrder.status)}>
//                             <span className="flex items-center gap-1">
//                               {getStatusIcon(backOrder.status)}
//                               {backOrder.status}
//                             </span>
//                           </Badge>
//                         </td>
//                         <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
//                           <div>
//                             {new Date(backOrder.createdAt).toLocaleDateString()}
//                           </div>
//                           {backOrder.fulfilledAt && (
//                             <div className="text-xs text-green-600">
//                               Fulfilled:{" "}
//                               {new Date(
//                                 backOrder.fulfilledAt
//                               ).toLocaleDateString()}
//                             </div>
//                           )}
//                         </td>
//                         <td className="px-4 py-3">
//                           {nextAction.isLink ? (
//                             <Link href={nextAction.action as string}>
//                               <Button
//                                 size="sm"
//                                 variant={nextAction.variant}
//                                 disabled={nextAction.disabled}
//                                 className="cursor-pointer"
//                               >
//                                 {nextAction.label}
//                               </Button>
//                             </Link>
//                           ) : nextAction.isAction ? (
//                             <Button
//                               size="sm"
//                               variant={nextAction.variant}
//                               onClick={nextAction.action as () => void}
//                               disabled={nextAction.disabled}
//                               className="cursor-pointer"
//                             >
//                               {nextAction.label}
//                             </Button>
//                           ) : nextAction.action ? (
//                             <Button
//                               size="sm"
//                               variant={nextAction.variant}
//                               onClick={nextAction.action as () => void}
//                               disabled={nextAction.disabled}
//                               className="cursor-pointer"
//                             >
//                               {fulfillMutation.isPending
//                                 ? "Allocating..."
//                                 : nextAction.label}
//                             </Button>
//                           ) : (
//                             <span className="text-sm text-gray-500 dark:text-gray-400">
//                               {nextAction.label}
//                             </span>
//                           )}
//                         </td>
//                       </tr>
//                     );
//                   })}
//                 </tbody>
//               </table>

//               {filteredBackOrders.length === 0 && (
//                 <div className="text-center py-12">
//                   <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
//                   <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
//                     No back orders{" "}
//                     {statusFilter !== "ALL" && `with status ${statusFilter}`}
//                   </h3>
//                   <p className="text-gray-600 dark:text-gray-300">
//                     {statusFilter === "ALL"
//                       ? "All orders are fully allocated"
//                       : "Try selecting a different status"}
//                   </p>
//                 </div>
//               )}
//             </div>
//           </CardContent>
//         </Card>
//       </div>
//     </div>
//   );
// }
