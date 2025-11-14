"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function POList(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/inventory-planner/purchase-orders")
      .then((res) => res.json())
      .then((data) => setOrders(data.orders));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Purchase Orders</h1>
      <table className="w-full border">
        <thead>
          <tr>
            <th className="p-2 text-left">PO #</th>
            <th className="p-2 text-left">Vendor</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">Total</th>
            <th className="p-2 text-left">Created</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((po) => (
            <tr key={po.id} className="border-t">
              <td className="p-2">
                <Link href={`/dashboard/pos/${po.id}`}>
                  <span className="text-blue-600 hover:underline">
                    {po.reference || po.poId}
                  </span>
                </Link>
              </td>
              <td className="p-2">{po.vendorName || "—"}</td>
              <td className="p-2">{po.status}</td>
              <td className="p-2">{po.totalValue?.toFixed(2) || "—"}</td>
              <td className="p-2">
                {new Date(po.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
