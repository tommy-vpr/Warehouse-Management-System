// dashboard/returns/packing-slip/[rmaNumber]/page.tsx
// Printable packing slip for customers to include in return package

"use client";

import { Button } from "@/components/ui/button";
import { Loader2, Package } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Barcode from "react-barcode";

interface ReturnOrder {
  rmaNumber: string;
  customerName: string;
  customerEmail: string;
  reason: string;
  reasonDetails?: string;
  createdAt: string;
  order: {
    orderNumber: string;
  };
  items: Array<{
    productVariant: {
      sku: string;
      name: string;
    };
    quantityRequested: number;
  }>;
}

export default function PackingSlipPage(props: {
  params: Promise<{ rmaNumber: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = useParams<{ rmaNumber: string }>(); // ← Use the hook
  const [returnOrder, setReturnOrder] = useState<ReturnOrder | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReturnDetails();
  }, [params.rmaNumber]);

  const fetchReturnDetails = async () => {
    try {
      const response = await fetch(`/api/returns/${params.rmaNumber}`);
      const data = await response.json();
      setReturnOrder(data);
    } catch (err) {
      console.error("Failed to load return details");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600 dark:text-gray-400">
            Loading packing slip...
          </p>
        </div>
      </div>
    );
  }

  if (!returnOrder) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="text-gray-600 dark:text-gray-400">Return not found</p>
      </div>
    );
  }

  return (
    <>
      {/* Packing Slip - Light for print, dark mode for screen */}
      <div className="max-w-4xl mx-auto p-8 bg-white dark:bg-zinc-900 min-h-screen">
        <Button
          variant={"outline"}
          onClick={handlePrint}
          className="print:hidden ml-auto block mb-8"
        >
          Print Packing Slip
        </Button>

        {/* Header - Print styling will override dark mode */}
        <div className="border-4 border-gray-900 dark:border-gray-700 print:border-gray-900 p-6 mb-6">
          <div className="text-center mb-4">
            <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100 print:text-gray-900">
              RETURN PACKING SLIP
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 print:text-gray-600">
              Please include this slip inside your return package
            </p>
          </div>

          {/* RMA Barcode - CRITICAL FOR WAREHOUSE */}
          <div className="bg-gray-100 dark:bg-zinc-800 print:bg-gray-100 p-6 text-center">
            <p className="text-sm text-gray-700 dark:text-gray-300 print:text-gray-700 mb-2">
              SCAN THIS BARCODE AT WAREHOUSE:
            </p>
            <div className="my-4 flex justify-center">
              <Barcode
                value={returnOrder.rmaNumber}
                format="CODE128"
                width={3}
                height={80}
                displayValue={true}
                fontSize={20}
                fontOptions="bold"
                margin={10}
              />
            </div>
          </div>
        </div>

        {/* Return Information */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="border border-gray-300 dark:border-zinc-700 print:border-gray-300 p-4">
            <h2 className="font-bold text-lg mb-3 border-b border-gray-300 dark:border-zinc-700 print:border-gray-300 pb-2 text-gray-900 dark:text-gray-100 print:text-gray-900">
              Return Information
            </h2>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600">
                  RMA Number:
                </p>
                <p className="font-mono font-bold text-gray-900 dark:text-gray-100 print:text-gray-900">
                  {returnOrder.rmaNumber}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600">
                  Original Order:
                </p>
                <p className="text-gray-900 dark:text-gray-100 print:text-gray-900">
                  {returnOrder.order.orderNumber}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600">
                  Return Created:
                </p>
                <p className="text-gray-900 dark:text-gray-100 print:text-gray-900">
                  {new Date(returnOrder.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>

          <div className="border border-gray-300 dark:border-zinc-700 print:border-gray-300 p-4">
            <h2 className="font-bold text-lg mb-3 border-b border-gray-300 dark:border-zinc-700 print:border-gray-300 pb-2 text-gray-900 dark:text-gray-100 print:text-gray-900">
              Customer Information
            </h2>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600">
                  Name:
                </p>
                <p className="text-gray-900 dark:text-gray-100 print:text-gray-900">
                  {returnOrder.customerName}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600">
                  Email:
                </p>
                <p className="text-gray-900 dark:text-gray-100 print:text-gray-900">
                  {returnOrder.customerEmail}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600">
                  Return Reason:
                </p>
                <p className="text-gray-900 dark:text-gray-100 print:text-gray-900">
                  {returnOrder.reason.replace(/_/g, " ")}
                </p>
                {returnOrder.reasonDetails && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 print:text-gray-600 italic mt-1">
                    "{returnOrder.reasonDetails}"
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Items Being Returned */}
        <div className="border border-gray-300 dark:border-zinc-700 print:border-gray-300 mb-6">
          <div className="bg-gray-100 dark:bg-zinc-800 print:bg-gray-100 p-3 border-b border-gray-300 dark:border-zinc-700 print:border-gray-300">
            <h2 className="font-bold text-lg text-gray-900 dark:text-gray-100 print:text-gray-900">
              Items Being Returned
            </h2>
          </div>
          <table className="w-full">
            <thead className="border-b border-gray-300 dark:border-zinc-700 print:border-gray-300">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 dark:text-gray-100 print:text-gray-900">
                  SKU
                </th>
                <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 dark:text-gray-100 print:text-gray-900">
                  Product Name
                </th>
                <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 dark:text-gray-100 print:text-gray-900">
                  Quantity
                </th>
              </tr>
            </thead>
            <tbody>
              {returnOrder.items.map((item, index) => (
                <tr
                  key={index}
                  className="border-b border-gray-200 dark:border-zinc-700 print:border-gray-200"
                >
                  <td className="px-4 py-3 font-mono text-sm text-gray-900 dark:text-gray-100 print:text-gray-900">
                    {item.productVariant.sku}
                  </td>
                  <td className="px-4 py-3 text-gray-900 dark:text-gray-100 print:text-gray-900">
                    {item.productVariant.name}
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-lg text-gray-900 dark:text-gray-100 print:text-gray-900">
                    {item.quantityRequested}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-gray-300 dark:border-zinc-700 print:border-gray-300">
              <tr>
                <td
                  colSpan={2}
                  className="px-4 py-3 text-right font-bold text-gray-900 dark:text-gray-100 print:text-gray-900"
                >
                  Total Items:
                </td>
                <td className="px-4 py-3 text-center font-bold text-lg text-gray-900 dark:text-gray-100 print:text-gray-900">
                  {returnOrder.items.reduce(
                    (sum, item) => sum + item.quantityRequested,
                    0
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Instructions */}
        <div className="border border-gray-300 dark:border-gray-700 print:border-gray-300 bg-gray-50 dark:bg-gray-800 print:bg-gray-50 p-4">
          <h2 className="font-bold flex items-center gap-3 text-lg mb-3 text-gray-900 dark:text-gray-100 print:text-gray-900">
            <Package className="h-6 w-6" /> Packing Instructions
          </h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-900 dark:text-gray-300 print:text-gray-900">
            <li>Print this packing slip</li>
            <li>
              <strong className="dark:text-green-400 print:text-black">
                Place this slip INSIDE the box
              </strong>{" "}
              with your items
            </li>
            <li>Pack items securely in original packaging if possible</li>
            <li>Seal the package</li>
            <li>
              Attach the shipping label to the{" "}
              <strong className="dark:text-green-400 print:text-black">
                OUTSIDE
              </strong>{" "}
              of the box
            </li>
            <li>Drop off at your nearest carrier location</li>
          </ol>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400 print:text-gray-600 border-t border-gray-200 dark:border-zinc-700 print:border-gray-200 pt-4">
          <p>Questions? Contact us at support@vprcollection.com</p>
          <p className="mt-2">
            This packing slip was generated on {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          /* Hide everything first */
          body * {
            visibility: hidden;
          }

          /* Show only the packing slip */
          .max-w-4xl,
          .max-w-4xl * {
            visibility: visible;
          }

          /* Position it top-left for printing */
          .max-w-4xl {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
          }

          /* Force light mode for print */
          * {
            background-color: white !important;
            color: black !important;
          }

          @page {
            size: letter;
            margin: 0.5in;
          }

          .print\\:hidden {
            display: none !important;
          }

          svg {
            page-break-inside: avoid;
          }

          table {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </>
  );
}
