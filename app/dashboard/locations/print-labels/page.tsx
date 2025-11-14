// app/locations/print-labels/page.tsx
"use client";

import { useState, useEffect } from "react";
import LocationBarcodeLabel from "@/components/location/LocationBarcodeLabel";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";

interface Location {
  id: string;
  name: string;
  type: string;
}

export default function PrintLabelsPage(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true); // Should start true
  const [error, setError] = useState(""); // Add error state

  useEffect(() => {
    setLoading(true);
    fetch("/api/locations")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch locations");
        return res.json();
      })
      .then((data) => {
        // API returns array directly, not wrapped in object
        setLocations(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600 dark:text-gray-400">
            Loading locations...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-800 dark:text-red-300">
                Error Loading Locations
              </h3>
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                {error}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-4 no-print">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Location Labels
        </h1>
        <p className="text-green-600 dark:text-green-400 mt-1">
          {locations.length} location{locations.length !== 1 ? "s" : ""} found
        </p>
        <Button
          onClick={() => window.print()}
          className="mt-4 cursor-pointer"
          disabled={locations.length === 0}
        >
          Print All Labels
        </Button>
      </div>

      {locations.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-gray-500 dark:text-gray-400">
            No locations found. Import locations first.
          </p>
        </div>
      ) : (
        <>
          {/* Print 4 labels per page */}
          <div className="grid grid-cols-2 gap-4">
            {locations.map((location) => (
              <LocationBarcodeLabel
                key={location.id}
                locationName={location.name}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
