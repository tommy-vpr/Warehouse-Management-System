import Link from "next/link";
import React from "react";

import { Import } from "lucide-react";

const ImportPage = (props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) => {
  return (
    <div className="min-h-screen flex justify-center items-center flex-col">
      <h3 className="mb-4 dark:text-gray-400">Import your file</h3>
      <div className="flex items-center gap-4">
        <Link
          href={"/dashboard/import/products"}
          className="py-2 px-4 hover:opacity-80 transition bg-gray-200 text-gray-700 dark:text-gray-200 dark:bg-blue-500 flex justify-center items-center gap-2
          rounded"
        >
          <Import size={18} /> Products
        </Link>
        <Link
          href={"/dashboard/import/locations"}
          className="py-2 px-4 hover:opacity-80 transition bg-gray-200 text-gray-700 dark:bg-gray-300-500 flex justify-center items-center gap-2
          rounded"
        >
          <Import size={18} /> Locations
        </Link>
      </div>
    </div>
  );
};

export default ImportPage;
