"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  MapPin,
  Loader2,
  LoaderCircle,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function VarianceReviewPage(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const campaignId = params.id;

  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [reviewNotes, setReviewNotes] = useState("");
  const [assignTo, setAssignTo] = useState<string>("");

  // Fetch assignable users
  const { data: users } = useQuery<User[]>({
    queryKey: ["assignable-users"],
    queryFn: async () => {
      const response = await fetch("/api/users/assignable");
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
  });

  // Fetch tasks needing review
  const { data: campaign, isLoading } = useQuery({
    queryKey: ["campaign-review", campaignId],
    queryFn: async () => {
      const response = await fetch(
        `/api/inventory/cycle-counts/campaigns/${campaignId}`
      );
      if (!response.ok) throw new Error("Campaign not found");
      const data = await response.json();

      return {
        ...data,
        tasks: data.tasks.filter(
          (t: any) =>
            t.status === "VARIANCE_REVIEW" || t.status === "RECOUNT_REQUIRED"
        ),
      };
    },
  });

  // Approve variance mutation
  const approveMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await fetch(
        `/api/inventory/cycle-counts/tasks/${taskId}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: reviewNotes }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to approve variance");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Variance Approved",
        description: "Task marked as completed",
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["campaign-review"] });
      moveToNextOrFinish();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Request recount mutation
  const recountMutation = useMutation({
    mutationFn: async (taskId: string) => {
      // ✅ Validate assignTo is selected
      if (!assignTo) {
        throw new Error("Please select a user for recount");
      }

      const response = await fetch(
        `/api/inventory/cycle-counts/tasks/${taskId}/request-recount`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notes: reviewNotes,
            assignTo: assignTo, // ✅ Now always required
          }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to request recount");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Recount Requested",
        description: "Task assigned for recount",
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["campaign-review"] });
      moveToNextOrFinish();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const moveToNextOrFinish = () => {
    setReviewNotes("");
    setAssignTo("");
    if (currentTaskIndex < (campaign?.tasks.length || 0) - 1) {
      setCurrentTaskIndex(currentTaskIndex + 1);
    } else {
      router.push(`/dashboard/inventory/count/${campaignId}/results`);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600 dark:text-gray-400">Loading review...</p>
        </div>
      </div>
    );
  }

  if (!campaign?.tasks.length) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            All Variances Reviewed!
          </h2>
          <Button
            onClick={() =>
              router.push(`/dashboard/inventory/count/${campaignId}/results`)
            }
          >
            View Results
          </Button>
        </div>
      </div>
    );
  }

  const currentTask = campaign.tasks[currentTaskIndex];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-6">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mr-4"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Variance Review</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Review {currentTaskIndex + 1} of {campaign.tasks.length}
            </p>
          </div>
        </div>

        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-lg mb-2">
                  {currentTask.productVariant?.product.name || "Location Count"}
                </h3>
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <MapPin className="w-4 h-4 mr-1" />
                  {currentTask.location.name}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">
                    {currentTask.systemQuantity}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    System Qty
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {currentTask.countedQuantity}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Counted Qty
                  </div>
                </div>
                <div>
                  <div
                    className={`text-2xl font-bold ${
                      currentTask.variance > 0
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  >
                    {currentTask.variance > 0 ? "+" : ""}
                    {currentTask.variance}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Variance ({currentTask.variancePercentage.toFixed(1)}%)
                  </div>
                </div>
              </div>

              {currentTask.notes && (
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                  <div className="text-sm font-medium mb-1">Counter Notes:</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {currentTask.notes}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">
                  Supervisor Notes
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add notes about your decision..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                {/* ✅ Changed label to required */}
                <label className="block text-sm font-medium mb-2">
                  Assign Recount To *
                </label>
                <Select value={assignTo} onValueChange={setAssignTo}>
                  <SelectTrigger className={!assignTo ? "border-red-400" : ""}>
                    <SelectValue placeholder="Admin or Manager" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* ✅ Removed "Unassigned" option */}
                    {users?.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* ✅ Added helper text */}
                <p className="text-xs text-gray-500 mt-1">
                  Required for recount requests
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={() => approveMutation.mutate(currentTask.id)}
                  disabled={
                    approveMutation.isPending || recountMutation.isPending
                  }
                >
                  {approveMutation.isPending ? (
                    <>
                      <LoaderCircle className="w-4 h-4 mr-2 animate-spin" />
                      Approving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve Variance
                    </>
                  )}
                </Button>
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={() => recountMutation.mutate(currentTask.id)}
                  disabled={
                    approveMutation.isPending ||
                    recountMutation.isPending ||
                    !assignTo // ✅ Disable if no user selected
                  }
                >
                  {recountMutation.isPending ? (
                    <>
                      <LoaderCircle className="w-4 h-4 mr-2 animate-spin" />
                      Requesting...
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Request Recount
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
// "use client";

// import React, { useState } from "react";
// import { Button } from "@/components/ui/button";
// import { Card, CardContent } from "@/components/ui/card";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import {
//   ArrowLeft,
//   CheckCircle,
//   AlertTriangle,
//   MapPin,
//   Loader2,
// } from "lucide-react";
// import { useParams, useRouter } from "next/navigation";
// import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// import { toast } from "@/hooks/use-toast";

// interface User {
//   id: string;
//   name: string;
//   email: string;
//   role: string;
// }

// export default function VarianceReviewPage() {
//   const params = useParams<{ id: string }>();
//   const router = useRouter();
//   const queryClient = useQueryClient();
//   const campaignId = params.id;

//   const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
//   const [reviewNotes, setReviewNotes] = useState("");
//   const [assignTo, setAssignTo] = useState<string>("");

//   // Fetch assignable users
//   const { data: users } = useQuery<User[]>({
//     queryKey: ["assignable-users"],
//     queryFn: async () => {
//       const response = await fetch("/api/users/assignable");
//       if (!response.ok) throw new Error("Failed to fetch users");
//       return response.json();
//     },
//   });

//   // Fetch tasks needing review
//   const { data: campaign, isLoading } = useQuery({
//     queryKey: ["campaign-review", campaignId],
//     queryFn: async () => {
//       const response = await fetch(
//         `/api/inventory/cycle-counts/campaigns/${campaignId}`
//       );
//       if (!response.ok) throw new Error("Campaign not found");
//       const data = await response.json();

//       return {
//         ...data,
//         tasks: data.tasks.filter(
//           (t: any) =>
//             t.status === "VARIANCE_REVIEW" || t.status === "RECOUNT_REQUIRED"
//         ),
//       };
//     },
//   });

//   // Approve variance mutation
//   const approveMutation = useMutation({
//     mutationFn: async (taskId: string) => {
//       const response = await fetch(
//         `/api/inventory/cycle-counts/tasks/${taskId}/approve`,
//         {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({ notes: reviewNotes }),
//         }
//       );
//       if (!response.ok) {
//         const error = await response.json();
//         throw new Error(error.error || "Failed to approve variance");
//       }
//       return response.json();
//     },
//     onSuccess: () => {
//       toast({
//         title: "Variance Approved",
//         description: "Task marked as completed",
//         variant: "success",
//       });
//       queryClient.invalidateQueries({ queryKey: ["campaign-review"] });
//       moveToNextOrFinish();
//     },
//     onError: (error: Error) => {
//       toast({
//         title: "Error",
//         description: error.message,
//         variant: "destructive",
//       });
//     },
//   });

//   // Request recount mutation
//   const recountMutation = useMutation({
//     mutationFn: async (taskId: string) => {
//       const response = await fetch(
//         `/api/inventory/cycle-counts/tasks/${taskId}/request-recount`,
//         {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({
//             notes: reviewNotes,
//             assignTo: assignTo || undefined,
//           }),
//         }
//       );
//       if (!response.ok) {
//         const error = await response.json();
//         throw new Error(error.error || "Failed to request recount");
//       }
//       return response.json();
//     },
//     onSuccess: () => {
//       toast({
//         title: "Recount Requested",
//         description: assignTo
//           ? "Task assigned for recount"
//           : "Worker will be notified",
//         variant: "success",
//       });
//       queryClient.invalidateQueries({ queryKey: ["campaign-review"] });
//       moveToNextOrFinish();
//     },
//     onError: (error: Error) => {
//       toast({
//         title: "Error",
//         description: error.message,
//         variant: "destructive",
//       });
//     },
//   });

//   const moveToNextOrFinish = () => {
//     setReviewNotes("");
//     setAssignTo("");
//     if (currentTaskIndex < (campaign?.tasks.length || 0) - 1) {
//       setCurrentTaskIndex(currentTaskIndex + 1);
//     } else {
//       router.push(`/dashboard/inventory/count/${campaignId}/results`);
//     }
//   };

//   if (isLoading) {
//     return (
//       <div className="min-h-screen bg-background flex items-center justify-center p-4">
//         <div className="text-center">
//           <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
//           <p className="text-gray-600 dark:text-gray-400">Loading review...</p>
//         </div>
//       </div>
//     );
//   }

//   if (!campaign?.tasks.length) {
//     return (
//       <div className="min-h-screen bg-background flex items-center justify-center">
//         <div className="text-center">
//           <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
//           <h2 className="text-xl font-semibold mb-2">
//             All Variances Reviewed!
//           </h2>
//           <Button
//             onClick={() =>
//               router.push(`/dashboard/inventory/count/${campaignId}/results`)
//             }
//           >
//             View Results
//           </Button>
//         </div>
//       </div>
//     );
//   }

//   const currentTask = campaign.tasks[currentTaskIndex];

//   return (
//     <div className="min-h-screen bg-background p-6">
//       <div className="max-w-4xl mx-auto">
//         <div className="flex items-center mb-6">
//           <Button
//             variant="ghost"
//             onClick={() => router.back()}
//             className="mr-4"
//           >
//             <ArrowLeft className="w-4 h-4" />
//           </Button>
//           <div>
//             <h1 className="text-2xl font-bold">Variance Review</h1>
//             <p className="text-gray-600 dark:text-gray-400">
//               Review {currentTaskIndex + 1} of {campaign.tasks.length}
//             </p>
//           </div>
//         </div>

//         <Card className="mb-6">
//           <CardContent className="p-6">
//             <div className="space-y-4">
//               <div>
//                 <h3 className="font-medium text-lg mb-2">
//                   {currentTask.productVariant?.product.name || "Location Count"}
//                 </h3>
//                 <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
//                   <MapPin className="w-4 h-4 mr-1" />
//                   {currentTask.location.name}
//                 </div>
//               </div>

//               <div className="grid grid-cols-3 gap-4 text-center">
//                 <div>
//                   <div className="text-2xl font-bold">
//                     {currentTask.systemQuantity}
//                   </div>
//                   <div className="text-sm text-gray-600 dark:text-gray-400">
//                     System Qty
//                   </div>
//                 </div>
//                 <div>
//                   <div className="text-2xl font-bold">
//                     {currentTask.countedQuantity}
//                   </div>
//                   <div className="text-sm text-gray-600 dark:text-gray-400">
//                     Counted Qty
//                   </div>
//                 </div>
//                 <div>
//                   <div
//                     className={`text-2xl font-bold ${
//                       currentTask.variance > 0
//                         ? "text-green-400"
//                         : "text-red-400"
//                     }`}
//                   >
//                     {currentTask.variance > 0 ? "+" : ""}
//                     {currentTask.variance}
//                   </div>
//                   <div className="text-sm text-gray-600 dark:text-gray-400">
//                     Variance ({currentTask.variancePercentage.toFixed(1)}%)
//                   </div>
//                 </div>
//               </div>

//               {currentTask.notes && (
//                 <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
//                   <div className="text-sm font-medium mb-1">Counter Notes:</div>
//                   <div className="text-sm text-gray-600 dark:text-gray-400">
//                     {currentTask.notes}
//                   </div>
//                 </div>
//               )}

//               <div>
//                 <label className="block text-sm font-medium mb-2">
//                   Supervisor Notes
//                 </label>
//                 <textarea
//                   value={reviewNotes}
//                   onChange={(e) => setReviewNotes(e.target.value)}
//                   placeholder="Add notes about your decision..."
//                   rows={3}
//                   className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
//                 />
//               </div>

//               <div>
//                 <label className="block text-sm font-medium mb-2">
//                   Assign Recount To (Optional)
//                 </label>
//                 <Select value={assignTo} onValueChange={setAssignTo}>
//                   <SelectTrigger>
//                     <SelectValue placeholder="Select user for recount" />
//                   </SelectTrigger>
//                   <SelectContent>
//                     <SelectItem value="unassigned">Unassigned</SelectItem>
//                     {users?.map((user) => (
//                       <SelectItem key={user.id} value={user.id}>
//                         {user.name} ({user.role})
//                       </SelectItem>
//                     ))}
//                   </SelectContent>
//                 </Select>
//               </div>

//               <div className="flex gap-3">
//                 <Button
//                   className="flex-1 bg-green-600 hover:bg-green-700"
//                   onClick={() => approveMutation.mutate(currentTask.id)}
//                   disabled={
//                     approveMutation.isPending || recountMutation.isPending
//                   }
//                 >
//                   <CheckCircle className="w-4 h-4 mr-2" />
//                   Approve Variance
//                 </Button>
//                 <Button
//                   className="flex-1"
//                   variant="outline"
//                   onClick={() => recountMutation.mutate(currentTask.id)}
//                   disabled={
//                     approveMutation.isPending || recountMutation.isPending
//                   }
//                 >
//                   <AlertTriangle className="w-4 h-4 mr-2" />
//                   Request Recount
//                 </Button>
//               </div>
//             </div>
//           </CardContent>
//         </Card>
//       </div>
//     </div>
//   );
// }
