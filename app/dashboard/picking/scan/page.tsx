// app/picking/scan/page.tsx
"use client";

import { useState } from "react";
import { LocationScanner } from "@/components/location/LocationScanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, MapPin, Loader2, AlertCircle, Scan } from "lucide-react";

interface ProductVariant {
  id: string;
  sku: string;
  name: string;
  upc: string | null;
  volume: string | null;
  strength: string | null;
  product: {
    id: string;
    name: string;
    brand: string | null;
    category: string | null;
  };
}

interface InventoryItem {
  id: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  casesOnHand: number | null;
  casesReserved: number | null;
  productVariant: ProductVariant;
}

interface LocationData {
  id: string;
  name: string;
  barcode: string;
  type: string;
  zone: string | null;
  warehouseNumber: number | null;
  aisle: string | null;
  bay: number | null;
  tier: string | null;
  space: number | null;
  bin: string | null;
  isPickable: boolean;
  isReceivable: boolean;
  inventory: InventoryItem[];
}

export default function PickingScanPage(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLocationScan = async (barcode: string) => {
    setError("");
    setLoading(true);
    setLocationData(null);

    // Fetch location and inventory data
    try {
      const response = await fetch(
        `/api/locations/${encodeURIComponent(barcode)}`
      );

      if (!response.ok) {
        throw new Error("Location not found");
      }

      const data: LocationData = await response.json();
      setLocationData(data);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || "Failed to fetch location data");
      setLocationData(null);
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Location Lookup</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Scan any location barcode to view inventory
      </p>

      <Button onClick={() => setScannerOpen(true)} className="w-full" size="lg">
        <MapPin className="w-4 h-4 mr-2" />
        Scan Location
      </Button>

      <LocationScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleLocationScan}
        title="Scan Location Barcode"
        placeholder="Scan or enter location (e.g., 1-E-13-A-3-X)"
      />

      {/* Loading State */}
      {loading && (
        <div className="mt-6 flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600 dark:text-gray-400">
            Loading location data...
          </span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-800 dark:text-red-300">
                Location Not Found
              </p>
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                {error}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Success - Show Location Data */}
      {locationData && !loading && !error && (
        <div className="mt-6 space-y-4">
          <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-300">
                <MapPin className="w-5 h-5" />
                {locationData.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Type:
                  </span>{" "}
                  <span className="font-medium">{locationData.type}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Zone:
                  </span>{" "}
                  <span className="font-medium">
                    {locationData.zone || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    Pickable:
                  </span>{" "}
                  <span className="font-medium">
                    {locationData.isPickable ? "Yes" : "No"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">
                    SKUs in location:
                  </span>{" "}
                  <span className="font-medium">
                    {locationData.inventory.length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Inventory Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Inventory at this Location
              </CardTitle>
            </CardHeader>
            <CardContent>
              {locationData.inventory.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No inventory at this location
                </p>
              ) : (
                <div className="space-y-3">
                  {locationData.inventory.map((item) => (
                    <div
                      key={item.id}
                      className="border dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <p className="font-medium text-lg">
                            {item.productVariant.product.name}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {item.productVariant.name}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-2xl font-bold text-blue-600">
                            {item.quantityAvailable}
                          </p>
                          <p className="text-xs text-gray-500">available</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm mt-3 pt-3 border-t dark:border-gray-700">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">
                            SKU:
                          </span>{" "}
                          <span className="font-mono">
                            {item.productVariant.sku}
                          </span>
                        </div>
                        {item.productVariant.upc && (
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">
                              UPC:
                            </span>{" "}
                            <span className="font-mono">
                              {item.productVariant.upc}
                            </span>
                          </div>
                        )}
                        {item.productVariant.volume && (
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">
                              Volume:
                            </span>{" "}
                            {item.productVariant.volume}
                          </div>
                        )}
                        {item.productVariant.strength && (
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">
                              Strength:
                            </span>{" "}
                            {item.productVariant.strength}
                          </div>
                        )}
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">
                            On Hand:
                          </span>{" "}
                          {item.quantityOnHand}
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">
                            Reserved:
                          </span>{" "}
                          {item.quantityReserved}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scan another button */}
          <Button
            onClick={() => setScannerOpen(true)}
            variant="secondary"
            className="w-full flex gap-2 items-center bg-blue-500 text-gray-200"
          >
            <Scan /> Scan Another Location
          </Button>
        </div>
      )}
    </div>
  );
}

// // app/picking/scan/page.tsx
// "use client";

// import { useState } from "react";
// import { LocationScanner } from "@/components/location/LocationScanner";
// import { Button } from "@/components/ui/button";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Package, MapPin, Loader2, AlertCircle } from "lucide-react";

// interface ProductVariant {
//   id: string;
//   sku: string;
//   name: string;
//   upc: string | null;
//   volume: string | null;
//   strength: string | null;
//   product: {
//     id: string;
//     name: string;
//     brand: string | null;
//     category: string | null;
//   };
// }

// interface InventoryItem {
//   id: string;
//   quantityOnHand: number;
//   quantityReserved: number;
//   quantityAvailable: number;
//   casesOnHand: number | null;
//   casesReserved: number | null;
//   productVariant: ProductVariant;
// }

// interface LocationData {
//   id: string;
//   name: string;
//   barcode: string;
//   type: string;
//   zone: string | null;
//   warehouseNumber: number | null;
//   aisle: string | null;
//   bay: number | null;
//   tier: string | null;
//   space: number | null;
//   bin: string | null;
//   isPickable: boolean;
//   isReceivable: boolean;
//   inventory: InventoryItem[];
// }

// export default function PickingScanPage() {
//   const [scannedLocation, setScannedLocation] = useState<string>("");
//   const [expectedLocation, setExpectedLocation] = useState("1-E-13-A-3-X");
//   const [scannerOpen, setScannerOpen] = useState(false);
//   const [locationData, setLocationData] = useState<LocationData | null>(null);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");

//   const handleLocationScan = async (barcode: string) => {
//     setScannedLocation(barcode);
//     setError("");
//     setLoading(true);

//     // Verify it matches expected location
//     if (barcode !== expectedLocation) {
//       setError(`Wrong location! Expected: ${expectedLocation}`);
//       setLoading(false);
//       return;
//     }

//     // Fetch location and inventory data
//     try {
//       const response = await fetch(
//         `/api/locations/${encodeURIComponent(barcode)}`
//       );

//       if (!response.ok) {
//         throw new Error("Location not found");
//       }

//       const data: LocationData = await response.json();
//       setLocationData(data);
//       setLoading(false);
//     } catch (err: any) {
//       setError(err.message || "Failed to fetch location data");
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="p-6 max-w-4xl mx-auto">
//       <h1 className="text-2xl font-bold mb-4">Scan Pick Location</h1>

//       <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
//         <div className="flex items-center gap-2">
//           <MapPin className="w-5 h-5 text-blue-600" />
//           <div>
//             <p className="text-sm text-gray-600 dark:text-gray-400">
//               Expected Location:
//             </p>
//             <p className="text-xl font-bold">{expectedLocation}</p>
//           </div>
//         </div>
//       </div>

//       <Button onClick={() => setScannerOpen(true)} className="w-full" size="lg">
//         Open Scanner
//       </Button>

//       <LocationScanner
//         isOpen={scannerOpen}
//         onClose={() => setScannerOpen(false)}
//         onScan={handleLocationScan}
//         expectedLocation={expectedLocation}
//         title="Scan Pick Location"
//       />

//       {/* Loading State */}
//       {loading && (
//         <div className="mt-6 flex items-center justify-center p-8">
//           <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
//           <span className="ml-2 text-gray-600 dark:text-gray-400">
//             Loading location data...
//           </span>
//         </div>
//       )}

//       {/* Error State */}
//       {error && (
//         <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
//           <div className="flex items-start">
//             <AlertCircle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
//             <div>
//               <p className="font-medium text-red-800 dark:text-red-300">
//                 Scan Error
//               </p>
//               <p className="text-sm text-red-600 dark:text-red-400 mt-1">
//                 {error}
//               </p>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Success - Show Location Data */}
//       {locationData && !loading && !error && (
//         <div className="mt-6 space-y-4">
//           <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
//             <CardHeader>
//               <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-300">
//                 <MapPin className="w-5 h-5" />
//                 Location Verified: {locationData.name}
//               </CardTitle>
//             </CardHeader>
//             <CardContent>
//               <div className="grid grid-cols-2 gap-4 text-sm">
//                 <div>
//                   <span className="text-gray-600 dark:text-gray-400">
//                     Type:
//                   </span>{" "}
//                   <span className="font-medium">{locationData.type}</span>
//                 </div>
//                 <div>
//                   <span className="text-gray-600 dark:text-gray-400">
//                     Zone:
//                   </span>{" "}
//                   <span className="font-medium">
//                     {locationData.zone || "N/A"}
//                   </span>
//                 </div>
//                 <div>
//                   <span className="text-gray-600 dark:text-gray-400">
//                     Pickable:
//                   </span>{" "}
//                   <span className="font-medium">
//                     {locationData.isPickable ? "Yes" : "No"}
//                   </span>
//                 </div>
//                 <div>
//                   <span className="text-gray-600 dark:text-gray-400">
//                     Items in location:
//                   </span>{" "}
//                   <span className="font-medium">
//                     {locationData.inventory.length}
//                   </span>
//                 </div>
//               </div>
//             </CardContent>
//           </Card>

//           {/* Inventory Items */}
//           <Card>
//             <CardHeader>
//               <CardTitle className="flex items-center gap-2">
//                 <Package className="w-5 h-5" />
//                 Inventory at this Location
//               </CardTitle>
//             </CardHeader>
//             <CardContent>
//               {locationData.inventory.length === 0 ? (
//                 <p className="text-gray-500 text-center py-4">
//                   No inventory at this location
//                 </p>
//               ) : (
//                 <div className="space-y-3">
//                   {locationData.inventory.map((item) => (
//                     <div
//                       key={item.id}
//                       className="border dark:border-gray-700 rounded-lg p-4"
//                     >
//                       <div className="flex justify-between items-start mb-2">
//                         <div>
//                           <p className="font-medium text-lg">
//                             {item.productVariant.product.name}
//                           </p>
//                           <p className="text-sm text-gray-600 dark:text-gray-400">
//                             {item.productVariant.name}
//                           </p>
//                         </div>
//                         <div className="text-right">
//                           <p className="text-2xl font-bold text-blue-600">
//                             {item.quantityAvailable}
//                           </p>
//                           <p className="text-xs text-gray-500">available</p>
//                         </div>
//                       </div>

//                       <div className="grid grid-cols-2 gap-2 text-sm mt-3 pt-3 border-t dark:border-gray-700">
//                         <div>
//                           <span className="text-gray-600 dark:text-gray-400">
//                             SKU:
//                           </span>{" "}
//                           <span className="font-mono">
//                             {item.productVariant.sku}
//                           </span>
//                         </div>
//                         {item.productVariant.upc && (
//                           <div>
//                             <span className="text-gray-600 dark:text-gray-400">
//                               UPC:
//                             </span>{" "}
//                             <span className="font-mono">
//                               {item.productVariant.upc}
//                             </span>
//                           </div>
//                         )}
//                         {item.productVariant.volume && (
//                           <div>
//                             <span className="text-gray-600 dark:text-gray-400">
//                               Volume:
//                             </span>{" "}
//                             {item.productVariant.volume}
//                           </div>
//                         )}
//                         {item.productVariant.strength && (
//                           <div>
//                             <span className="text-gray-600 dark:text-gray-400">
//                               Strength:
//                             </span>{" "}
//                             {item.productVariant.strength}
//                           </div>
//                         )}
//                         <div>
//                           <span className="text-gray-600 dark:text-gray-400">
//                             On Hand:
//                           </span>{" "}
//                           {item.quantityOnHand}
//                         </div>
//                         <div>
//                           <span className="text-gray-600 dark:text-gray-400">
//                             Reserved:
//                           </span>{" "}
//                           {item.quantityReserved}
//                         </div>
//                       </div>
//                     </div>
//                   ))}
//                 </div>
//               )}
//             </CardContent>
//           </Card>
//         </div>
//       )}
//     </div>
//   );
// }
