"use client";

import React, { useState, useCallback } from "react";
import {
  Upload,
  MapPin,
  AlertCircle,
  CheckCircle,
  Loader2,
  Database,
  Package,
} from "lucide-react";

interface PageProps {
  params: Promise<Record<string, string>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface ParsedRow {
  SKU: string;
  LOCATION: string;
  WAREHOUSE: string;
  AISLE: string;
  BAY: string;
  TIER: string;
  SPACE: string;
  BIN: string;
}

interface LocationGroup {
  location: {
    name: string;
    warehouseNumber: number;
    aisle: string;
    bay: number;
    tier: string;
    space: number;
    bin: string;
    barcode: string;
    type: string;
    zone: string;
    isPickable: boolean;
    isReceivable: boolean;
  };
  skus: string[];
}

const LocationInventoryImport = ({ params, searchParams }: PageProps) => {
  const [step, setStep] = useState(1);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [importProgress, setImportProgress] = useState({
    current: 0,
    total: 0,
  });
  const [summary, setSummary] = useState({ locations: 0, inventory: 0 });

  const parseCSV = (csvText: string): ParsedRow[] => {
    const lines = csvText.trim().split("\n");
    const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));

    return lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });
      return row as ParsedRow;
    });
  };

  const determineLocationType = (tier: string): string => {
    switch (tier) {
      case "A":
        return "STORAGE";
      case "B":
        return "PICKING";
      case "C":
        return "PICKING";
      default:
        return "GENERAL";
    }
  };

  const handleCSVUpload = useCallback((file: File) => {
    setLoading(true);
    setError("");
    setSuccess("");

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const csvData = parseCSV(e.target?.result as string);

        const requiredColumns = [
          "SKU",
          "LOCATION",
          "WAREHOUSE",
          "AISLE",
          "BAY",
          "TIER",
          "SPACE",
          "BIN",
        ];

        const hasAllColumns = requiredColumns.every((col) =>
          csvData[0]?.hasOwnProperty(col)
        );

        if (!hasAllColumns) {
          throw new Error(
            `CSV must contain columns: ${requiredColumns.join(", ")}`
          );
        }

        const uniqueLocations = new Set(csvData.map((row) => row.LOCATION));

        setParsedData(csvData);
        setSummary({
          locations: uniqueLocations.size,
          inventory: csvData.length,
        });

        setSuccess(
          `Successfully parsed ${uniqueLocations.size} unique locations with ${csvData.length} inventory assignments`
        );
        setStep(2);
        setLoading(false);
      } catch (err) {
        setError(`Error parsing CSV: ${(err as Error).message}`);
        setLoading(false);
      }
    };
    reader.readAsText(file);
  }, []);

  const importToDatabase = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const locationGroups: Record<string, LocationGroup> = {};
      parsedData.forEach((row) => {
        if (!locationGroups[row.LOCATION]) {
          locationGroups[row.LOCATION] = {
            location: {
              name: row.LOCATION,
              warehouseNumber: parseInt(row.WAREHOUSE),
              aisle: row.AISLE,
              bay: parseInt(row.BAY),
              tier: row.TIER,
              space: parseInt(row.SPACE),
              bin: row.BIN,
              barcode: row.LOCATION,
              type: determineLocationType(row.TIER),
              zone: `WH${row.WAREHOUSE}-AISLE${row.AISLE}`,
              isPickable: row.TIER === "B" || row.TIER === "C",
              isReceivable: true,
            },
            skus: [],
          };
        }
        locationGroups[row.LOCATION].skus.push(row.SKU);
      });

      const locations = Object.values(locationGroups);
      setImportProgress({ current: 0, total: locations.length });

      for (let i = 0; i < locations.length; i++) {
        const locationData = locations[i];

        const response = await fetch("/api/inventory/locations/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(locationData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error ||
              `Failed to import location ${locationData.location.name}`
          );
        }

        setImportProgress({ current: i + 1, total: locations.length });
      }

      setSuccess(
        `Successfully imported ${summary.locations} locations with ${summary.inventory} inventory records!`
      );
      setStep(3);
      setLoading(false);
    } catch (err) {
      setError(`Import failed: ${(err as Error).message}`);
      setLoading(false);
    }
  };

  const FileDropZone = ({
    onFileSelect,
  }: {
    onFileSelect: (file: File) => void;
  }) => {
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files);
      if (files[0]) onFileSelect(files[0]);
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) onFileSelect(e.target.files[0]);
    };

    return (
      <div
        className="border-2 border-dashed border-blue-300 rounded-lg p-12 text-center hover:border-blue-400 transition-colors bg-blue-50 dark:bg-black/30 dark:border-gray-600"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <MapPin className="mx-auto h-16 w-16 text-blue-500 mb-4" />
        <h3 className="text-xl font-medium text-gray-900 dark:text-gray-200 mb-2">
          Upload Location
        </h3>
        <div className="text-gray-600 dark:text-gray-400 mb-4">
          <p className="mb-2">Expected columns:</p>
          <div className="grid grid-cols-2 gap-2 text-sm max-w-md mx-auto">
            <span className="font-mono bg-gray-200 dark:bg-zinc-800 px-2 py-1 rounded">
              SKU
            </span>
            <span className="font-mono bg-gray-200 dark:bg-zinc-800 px-2 py-1 rounded">
              LOCATION
            </span>
            <span className="font-mono bg-gray-200 dark:bg-zinc-800 px-2 py-1 rounded">
              WAREHOUSE
            </span>
            <span className="font-mono bg-gray-200 dark:bg-zinc-800 px-2 py-1 rounded">
              AISLE
            </span>
            <span className="font-mono bg-gray-200 dark:bg-zinc-800 px-2 py-1 rounded">
              BAY
            </span>
            <span className="font-mono bg-gray-200 dark:bg-zinc-800 px-2 py-1 rounded">
              TIER
            </span>
            <span className="font-mono bg-gray-200 dark:bg-zinc-800 px-2 py-1 rounded">
              SPACE
            </span>
            <span className="font-mono bg-gray-200 dark:bg-zinc-800 px-2 py-1 rounded">
              BIN
            </span>
          </div>
        </div>
        <label className="bg-blue-500 text-white px-6 py-3 rounded-md cursor-pointer hover:bg-blue-600 inline-block">
          Choose Location CSV File
          <input
            type="file"
            accept=".csv"
            onChange={handleFileInput}
            className="hidden"
          />
        </label>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Will create locations and link SKUs for inventory
        </p>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-background min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
          <MapPin className="mr-3 h-8 w-8 text-blue-600" />
          Location Import
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Import locations and create inventory records for SKUs
        </p>
      </div>

      <div className="mb-8">
        <div className="flex items-center">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full ${
              step >= 1 ? "bg-blue-500 text-white" : "bg-gray-300 text-gray-600"
            }`}
          >
            1
          </div>
          <div
            className={`flex-1 h-1 mx-4 ${
              step >= 2 ? "bg-blue-500" : "bg-gray-300"
            }`}
          ></div>
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full ${
              step >= 2 ? "bg-blue-500 text-white" : "bg-gray-300 text-gray-600"
            }`}
          >
            2
          </div>
          <div
            className={`flex-1 h-1 mx-4 ${
              step >= 3 ? "bg-blue-500" : "bg-gray-300"
            }`}
          ></div>
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full ${
              step >= 3 ? "bg-blue-500 text-white" : "bg-gray-300 text-gray-600"
            }`}
          >
            3
          </div>
        </div>
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mt-2">
          <span>Upload CSV</span>
          <span>Review Data</span>
          <span>Import Complete</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 mb-6">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
            <div className="ml-3">
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4 mb-6">
          <div className="flex">
            <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
            <div className="ml-3">
              <p className="text-sm text-green-800 dark:text-green-300">
                {success}
              </p>
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          <FileDropZone onFileSelect={handleCSVUpload} />
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-600 dark:text-gray-400">
                Processing CSV...
              </span>
            </div>
          )}
        </div>
      )}

      {step === 2 && parsedData.length > 0 && (
        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Review Import Data
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm dark:text-gray-300">
              <div className="flex items-center">
                <MapPin className="h-5 w-5 text-blue-600 mr-2" />
                <span>
                  <strong>{summary.locations}</strong> unique locations to
                  create
                </span>
              </div>
              <div className="flex items-center">
                <Package className="h-5 w-5 text-blue-600 mr-2" />
                <span>
                  <strong>{summary.inventory}</strong> inventory records to
                  create
                </span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
              Sample Data Preview
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-gray-700">
                    <th className="text-left py-2 px-3">SKU</th>
                    <th className="text-left py-2 px-3">Location</th>
                    <th className="text-left py-2 px-3">WH</th>
                    <th className="text-left py-2 px-3">Aisle</th>
                    <th className="text-left py-2 px-3">Bay</th>
                    <th className="text-left py-2 px-3">Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.slice(0, 5).map((row, idx) => (
                    <tr key={idx} className="border-b dark:border-gray-700">
                      <td className="py-2 px-3 font-mono text-xs">{row.SKU}</td>
                      <td className="py-2 px-3">{row.LOCATION}</td>
                      <td className="py-2 px-3">{row.WAREHOUSE}</td>
                      <td className="py-2 px-3">{row.AISLE}</td>
                      <td className="py-2 px-3">{row.BAY}</td>
                      <td className="py-2 px-3">{row.TIER}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Showing first 5 of {parsedData.length} records
            </p>
          </div>

          {loading && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Importing locations...
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {importProgress.current} / {importProgress.total}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      (importProgress.current / importProgress.total) * 100
                    }%`,
                  }}
                ></div>
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              disabled={loading}
              className="px-4 py-2 text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              Back to Upload
            </button>
            <button
              onClick={importToDatabase}
              disabled={loading}
              className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed inline-flex items-center"
            >
              <Database className="h-4 w-4 mr-2" />
              Import to Database
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-medium text-gray-900 dark:text-gray-100 mb-2">
              Import Successful!
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Successfully imported <strong>{summary.locations}</strong>{" "}
              locations with <strong>{summary.inventory}</strong> inventory
              records.
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
              What was imported:
            </h3>
            <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
              <li>
                ✅ Locations with warehouse, aisle, bay, tier, space, bin data
              </li>
              <li>✅ Location barcodes generated automatically</li>
              <li>
                ✅ Location types assigned (STORAGE/PICKING based on tier)
              </li>
              <li>✅ Inventory records created linking SKUs to locations</li>
              <li>✅ Zone groupings (WH1-AISLEA, etc.)</li>
            </ul>
          </div>

          <div className="flex justify-center space-x-4">
            <button
              onClick={() => {
                setStep(1);
                setParsedData([]);
                setError("");
                setSuccess("");
                setSummary({ locations: 0, inventory: 0 });
              }}
              className="px-6 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
            >
              Import Another File
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationInventoryImport;
