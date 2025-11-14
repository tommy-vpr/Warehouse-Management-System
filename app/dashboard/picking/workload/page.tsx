// app/(dashboard)/picking/workload/page.tsx
import AdminReassignmentDashboard from "@/components/picking/AdminReassignmentDashboard";

export default function WorkloadManagementPage(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return <AdminReassignmentDashboard />;
}
