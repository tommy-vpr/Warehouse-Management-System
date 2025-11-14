import PickListDashboard from "@/components/picking/PickListDashboard";

export default function ActivePickListsPage(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return <PickListDashboard />;
}
