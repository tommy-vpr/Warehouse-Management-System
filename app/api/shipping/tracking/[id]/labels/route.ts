import { PDFDocument } from "pdf-lib";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const res = await fetch(
    `${process.env.BASE_URL}/api/shipping/tracking/${id}`
  );

  if (!res.ok) {
    return new Response("Tracking info not found", { status: 404 });
  }

  const trackingInfo = await res.json();

  const mergedPdf = await PDFDocument.create();

  for (const pkg of trackingInfo.packages) {
    try {
      const pdfBytes = await fetch(pkg.labelUrl).then((r) => r.arrayBuffer());
      const singlePdf = await PDFDocument.load(pdfBytes);
      const pages = await mergedPdf.copyPages(
        singlePdf,
        singlePdf.getPageIndices()
      );
      pages.forEach((page) => mergedPdf.addPage(page));
    } catch (err) {
      console.error(`Failed to load label for package ${pkg.id}`, err);
      // optionally skip instead of failing
    }
  }

  const bytes = await mergedPdf.save();

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${trackingInfo.order.orderNumber}-labels.pdf"`,
    },
  });
}
