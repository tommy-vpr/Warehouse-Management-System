"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function PODetail(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = useParams();
  const [po, setPo] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/inventory-planner/purchase-orders/${id}`)
      .then((res) => res.json())
      .then((data) => setPo(data));
  }, [id]);

  if (!po) return <p>Loading...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">PO {po.reference || po.poId}</h1>
      <p>
        <strong>Vendor:</strong> {po.vendorName || "—"}
      </p>
      <p>
        <strong>Status:</strong> {po.status}
      </p>
      <p>
        <strong>Total:</strong> {po.totalValue?.toFixed(2)}
      </p>
      <p>
        <strong>Created:</strong> {new Date(po.createdAt).toLocaleString()}
      </p>

      <h2 className="text-xl font-semibold mt-6 mb-2">Line Items</h2>
      <table className="w-full border">
        <thead>
          <tr>
            <th className="p-2 text-left">SKU</th>
            <th className="p-2 text-left">Product</th>
            <th className="p-2 text-left">Qty Ordered</th>
            <th className="p-2 text-left">Unit Cost</th>
            <th className="p-2 text-left">Total Cost</th>
          </tr>
        </thead>
        <tbody>
          {po.lines.map((line: any) => (
            <tr key={line.id} className="border-t">
              <td className="p-2">{line.sku}</td>
              <td className="p-2">{line.productName}</td>
              <td className="p-2">{line.qtyOrdered}</td>
              <td className="p-2">{line.unitCost ?? "—"}</td>
              <td className="p-2">{line.totalCost ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
