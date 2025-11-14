// app/(dashboard)/picking/page.tsx
import AssignOrdersToStaff from "@/components/picking/AssignOrdersToStaff";

export default function PickingManagementPage(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return <AssignOrdersToStaff />;
}
