// app/dashboard/picking/progress/[id]/page.tsx
import PickListProgressView from "@/components/picking/Picklistprogressview";

export default async function PickListProgressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PickListProgressView pickListId={id} />;
}
