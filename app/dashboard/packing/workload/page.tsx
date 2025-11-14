// app/(dashboard)/packing/workload/page.tsx
import AdminPackingReassignmentDashboard from "@/components/packing/AdminPackingReassignmentDashboard";

export default function PackingWorkloadManagementPage(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return <AdminPackingReassignmentDashboard />;
}
