// app/dashboard/packing/progress/[id]/page.tsx
import PackingTaskProgressView from "@/components/packing/PackingTaskProgressView";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PackingProgressPage({ params }: PageProps) {
  const { id } = await params;

  return <PackingTaskProgressView taskId={id} />;
}
