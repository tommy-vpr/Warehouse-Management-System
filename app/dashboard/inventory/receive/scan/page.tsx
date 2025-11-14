// app/dashboard/inventory/receive/scan/page.tsx
"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Package,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
  XCircle,
  ScanBarcode,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: string;
  sku: string;
  name: string;
  upc?: string;
}

interface PurchaseOrder {
  id: string;
  reference: string;
  vendor_name: string;
  line_items: Array<{
    sku: string;
    product_name: string;
    quantity_ordered: number;
    upc?: string;
  }>;
}

interface TallyCount {
  [sku: string]: number;
}

export default function BarcodeScanReceivingPage(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [step, setStep] = useState<"scan-po" | "scan-products" | "review">(
    "scan-po"
  );
  const [poBarcode, setPOBarcode] = useState("");
  const [po, setPO] = useState<PurchaseOrder | null>(null);
  const [tallyCounts, setTallyCounts] = useState<TallyCount>({});
  const [productScanInput, setProductScanInput] = useState("");
  const [lastScannedSKU, setLastScannedSKU] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanQty, setScanQty] = useState(1);

  const [selectedApprover, setSelectedApprover] = useState<string>("");
  const [approvers, setApprovers] = useState<
    Array<{
      id: string;
      name: string;
      email: string;
      role: string;
    }>
  >([]);

  const poScanRef = useRef<HTMLInputElement>(null);
  const productScanRef = useRef<HTMLInputElement>(null);

  // Helper to clean barcode input
  const cleanBarcodeInput = (input: string): string => {
    return input
      .trim()
      .replace(/^].*?(?=\d)/, "") // remove GS1 prefixes like ]C1
      .replace(/[^\w\d-]/g, ""); // strip all invisible control chars
  };

  // Fetch approvers when reaching review step
  useEffect(() => {
    if (step === "review") {
      const fetchApprovers = async () => {
        try {
          const res = await fetch("/api/users/approvers");
          const data = await res.json();
          if (data.success) {
            setApprovers(data.approvers);
          }
        } catch (err) {
          console.error("Failed to fetch approvers:", err);
        }
      };
      fetchApprovers();
    }
  }, [step]);

  // Auto-focus on input fields
  useEffect(() => {
    if (step === "scan-po" && poScanRef.current) {
      poScanRef.current.focus();
    } else if (step === "scan-products" && productScanRef.current) {
      productScanRef.current.focus();
    }
  }, [step]);

  // Clear last scanned highlight after 2 seconds
  useEffect(() => {
    if (lastScannedSKU) {
      const timer = setTimeout(() => setLastScannedSKU(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [lastScannedSKU]);

  // Clear scan error after 3 seconds
  useEffect(() => {
    if (scanError) {
      const timer = setTimeout(() => setScanError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [scanError]);

  // ✅ Load existing session on mount
  useEffect(() => {
    if (step !== "scan-products" || !po) return;

    const loadExistingSession = async () => {
      try {
        const res = await fetch(`/api/inventory/receive/session/${po.id}`);

        if (!res.ok) {
          console.log("No existing session found");
          return;
        }

        const data = await res.json();

        if (data.session && data.session.lineItems.length > 0) {
          // ✅ Populate tallyCounts from database
          const counts: TallyCount = {};
          data.session.lineItems.forEach((line: any) => {
            counts[line.sku] = line.quantityCounted;
          });

          setTallyCounts(counts);

          toast({
            title: "Session Resumed",
            description: `Loaded ${data.session.lineItems.length} previously scanned items`,
            variant: "success",
          });
        }
      } catch (err) {
        console.error("Failed to load session:", err);
        // Don't show error to user - just start fresh
      }
    };

    loadExistingSession();
  }, [step, po, toast]);

  // ✅ PRODUCTION-READY: Smart scanner detection
  useEffect(() => {
    if (step !== "scan-products" || !po) return;

    let buffer = "";
    let timer: NodeJS.Timeout | null = null;
    let lastKeyTime = 0;
    const SCANNER_SPEED_THRESHOLD = 50; // Scanners type <50ms between chars
    const HUMAN_SPEED_THRESHOLD = 150; // Humans type >150ms between chars
    let isScannerInput = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      const timeSinceLastKey = now - lastKeyTime;

      // Detect if this is scanner input (very fast typing)
      if (timeSinceLastKey < SCANNER_SPEED_THRESHOLD && buffer.length > 0) {
        isScannerInput = true;
      }

      // Reset if typing too slow (human speed)
      if (timeSinceLastKey > HUMAN_SPEED_THRESHOLD) {
        buffer = "";
        isScannerInput = false;
      }

      // Handle Enter key
      if (e.key === "Enter") {
        if (buffer.length >= 6 && isScannerInput) {
          e.preventDefault(); // Only prevent if it's scanner input
          processScan(buffer);
        }
        buffer = "";
        isScannerInput = false;
        lastKeyTime = 0;
        return;
      }

      // Build buffer from regular characters
      if (e.key.length === 1) {
        // Only prevent default if we're confident it's scanner input
        if (isScannerInput || buffer.length >= 3) {
          e.preventDefault();
        }

        buffer += e.key;
        lastKeyTime = now;

        if (timer) clearTimeout(timer);

        // Process if no more input for 50ms (scanner finished)
        timer = setTimeout(() => {
          if (buffer.length >= 6 && isScannerInput) {
            processScan(buffer);
          }
          buffer = "";
          isScannerInput = false;
          lastKeyTime = 0;
        }, 50); // Shorter timeout for scanners
      }
    };

    const processScan = async (rawBarcode: string) => {
      const cleaned = cleanBarcodeInput(rawBarcode);
      setProductScanInput(""); // Clear input

      try {
        const res = await fetch("/api/inventory/po-barcode/scan-product", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            poId: po.id,
            upc: cleaned,
            quantity: scanQty,
            source: "SCAN_GUN",
          }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          setScanError(data.error || "Scan failed");
          return;
        }

        const sku = data.variant.sku;
        const isInPO = po.line_items.some((item) => item.sku === sku);

        if (!isInPO) {
          setScanError(`⚠️ ${data.variant.name} is not in this PO`);
        }

        setTallyCounts((prev) => ({
          ...prev,
          [sku]: (prev[sku] || 0) + scanQty,
        }));

        setLastScannedSKU(sku);

        // Beep
        if (typeof window !== "undefined") {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = isInPO ? 800 : 400;
          gain.gain.value = 0.3;
          osc.start();
          osc.stop(ctx.currentTime + 0.1);
        }
      } catch (err) {
        console.error("Scan failed:", err);
        setScanError("Network or server error");
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (timer) clearTimeout(timer);
    };
  }, [step, po, scanQty]);

  // Scan PO barcode mutation
  const scanPOMutation = useMutation({
    mutationFn: async (barcodeValue: string) => {
      const res = await fetch("/api/inventory/po-barcode/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcodeValue }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to scan PO barcode");
      }

      return res.json();
    },
    onSuccess: (data) => {
      setPO(data.po);
      setPOBarcode("");
      setStep("scan-products");
      toast({
        title: "PO Loaded",
        description: `Ready to receive PO ${data.po.reference}`,
        variant: "success",
      });
    },
    onError: (error: Error) => {
      setPOBarcode("");
      toast({
        variant: "destructive",
        title: "Scan Failed",
        description: error.message,
      });
      setTimeout(() => {
        poScanRef.current?.focus();
      }, 100);
    },
  });

  // Update submitMutation to accept assignedTo
  const submitMutation = useMutation({
    mutationFn: async ({
      tallyCounts,
      assignedTo,
    }: {
      tallyCounts: TallyCount;
      assignedTo: string;
    }) => {
      if (!po) throw new Error("No PO loaded");

      const expectedQuantities: any = { metadata: {} };
      po.line_items.forEach((item) => {
        const trimmedSku = item.sku.trim();
        expectedQuantities[trimmedSku] = item.quantity_ordered;
        expectedQuantities.metadata[trimmedSku] = {
          name: item.product_name,
        };
      });

      const res = await fetch("/api/inventory/receive/po", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poId: po.id,
          poReference: po.reference,
          vendor: po.vendor_name,
          lineCounts: tallyCounts,
          expectedQuantities,
          assignedTo, // ✅ Include selected approver
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to submit receiving");
      }

      return res.json();
    },
    onSuccess: (data) => {
      const approverName = approvers.find(
        (a) => a.id === selectedApprover
      )?.name;
      toast({
        title: "✅ Submitted for Approval!",
        description: `Assigned to ${approverName || "manager"} for approval.`,
      });
      queryClient.invalidateQueries({ queryKey: ["pending-receiving"] });
      router.push("/dashboard/inventory/receive/pending");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "❌ Failed to Submit",
        description: error.message,
      });
    },
  });

  // Handle PO scan
  const handlePOScan = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = cleanBarcodeInput(poBarcode);
    if (cleaned) {
      scanPOMutation.mutate(cleaned);
    }
  };

  // ✅ Handle product scan - allows rapid concurrent scanning
  const handleProductScan = async (e: FormEvent) => {
    e.preventDefault();
    const value = productScanInput.trim();
    if (!value || !po) return; // ✅ Removed isSubmitting check!

    // Clear input immediately for next scan
    setProductScanInput("");
    setScanError("");

    try {
      const res = await fetch("/api/inventory/po-barcode/scan-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poId: po.id,
          upc: value,
          quantity: scanQty,
          source: "SCAN_GUN",
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setScanError(data.error || "Scan failed");
        return;
      }

      // ✅ Update tally with returned variant SKU
      const sku = data.variant.sku;
      const isInPO = po.line_items.some((item) => item.sku === sku);

      if (!isInPO) {
        setScanError(`⚠️ ${data.variant.name} is not in this PO`);
      }

      setTallyCounts((prev) => ({
        ...prev,
        [sku]: (prev[sku] || 0) + scanQty,
      }));

      setLastScannedSKU(sku);

      // Beep feedback
      if (typeof window !== "undefined") {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = isInPO ? 800 : 400;
        gain.gain.value = 0.3;
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      }
    } catch (err) {
      console.error("Scan failed:", err);
      setScanError("Network or server error");
    }
  };

  const handleManualAdjust = (sku: string, delta: number) => {
    setTallyCounts((prev) => {
      const current = prev[sku] || 0;
      const newValue = Math.max(0, current + delta);
      return { ...prev, [sku]: newValue };
    });
  };

  const handleDone = () => {
    setStep("review");
  };

  const handleBackToScanning = () => {
    setStep("scan-products");
  };

  // Update handleSubmit to include selected approver
  const handleSubmit = () => {
    if (!selectedApprover) {
      toast({
        variant: "destructive",
        title: "Approver Required",
        description: "Please select who should approve this receiving",
      });
      return;
    }

    submitMutation.mutate({
      tallyCounts,
      assignedTo: selectedApprover,
    });
  };

  // Calculate totals
  const totalScanned = Object.values(tallyCounts).reduce(
    (sum, count) => sum + count,
    0
  );
  const itemsCounted = Object.keys(tallyCounts).filter(
    (sku) => tallyCounts[sku] > 0
  ).length;

  // STEP 1: Scan PO Barcode
  if (step === "scan-po") {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                Scan Purchase Order
              </CardTitle>
              <p className="text-gray-600 dark:text-gray-400">
                Scan the PO barcode to begin receiving
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handlePOScan}>
                <div className="relative">
                  <ScanBarcode className="absolute left-3 top-3 w-6 h-6 text-gray-400 pointer-events-none" />
                  <Input
                    ref={poScanRef}
                    type="text"
                    value={poBarcode}
                    onChange={(e) => setPOBarcode(e.target.value)}
                    placeholder="Scan or enter PO barcode"
                    className="pl-12 text-xs md:text-lg py-6"
                    autoFocus
                  />
                </div>
                <button type="submit" className="hidden" aria-hidden="true" />
              </form>

              {scanPOMutation.isPending && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  <span className="ml-2 text-gray-600">Loading PO...</span>
                </div>
              )}

              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                <p className="text-sm text-yellow-900 dark:text-yellow-500">
                  <strong>Tip:</strong> Position scanner over the PO barcode and
                  press trigger, or manually type and press Enter
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // STEP 2: Scan Products
  if (step === "scan-products" && po) {
    return (
      <div className="min-h-screen bg-background flex flex-col p-4">
        <Card className="sticky top-0 z-10">
          <div className="max-w-6xl mx-auto p-3 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-md md:text-2xl font-bold flex items-center gap-2">
                  <Badge variant="outline">Receiving:</Badge> {po.reference}
                </span>
                <p className="text-gray-600 dark:text-gray-400">
                  Vendor: {po.vendor_name}
                </p>
              </div>
              <Badge
                className="text-sm md:text-lg px-2 py-1 md:px-4 md:py-2 bg-green-50 border-green-400 text-green-600
              dark:bg-green-900/20 dark:border-green-400 dark:text-green-400"
              >
                {itemsCounted} / {po.line_items.length} items
              </Badge>
            </div>

            {/* Qty picker */}
            <div className="flex items-center gap-2 mb-4">
              <label className="text-sm text-gray-600 dark:text-blue-500 mr-2">
                Qty per scan:
              </label>

              <div className="flex gap-2">
                {[1, 20, 50, 100].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setScanQty(q)}
                    className={`w-[36px] h-[36px] flex justify-center items-center rounded-md border text-sm font-medium transition-colors ${
                      scanQty === q
                        ? "bg-green-600 text-white border-green-600"
                        : "bg-white dark:bg-zinc-800 hover:bg-gray-100 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-zinc-700"
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* ✅ FIXED: No disabled prop for continuous scanning */}
            <form onSubmit={handleProductScan}>
              <div className="relative">
                <ScanBarcode className="absolute left-3 top-4 w-5 h-5 text-gray-400 pointer-events-none" />
                <Input
                  ref={productScanRef}
                  type="text"
                  value={productScanInput}
                  onChange={(e) => setProductScanInput(e.target.value)}
                  placeholder="Scan product UPC or barcode"
                  className="pl-10 text-sm md:text-lg py-6 bg-white"
                />
              </div>
              <button type="submit" className="hidden" aria-hidden="true" />
            </form>

            {/* Scan Error Display */}
            {scanError && (
              <div className="mt-3 bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
                  <p className="text-yellow-800 font-medium">{scanError}</p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Product List */}
        <div className="max-w-6xl mx-auto my-4 md:my-0 p-0 md:p-6">
          <div className="flex flex-col gap-4">
            {po.line_items.map((item) => {
              const counted = tallyCounts[item.sku] || 0;
              const expected = item.quantity_ordered;
              const isComplete = counted === expected;
              const isHighlighted = lastScannedSKU === item.sku;

              return (
                <Card
                  key={item.sku}
                  className={`w-full transition-all ${
                    isHighlighted
                      ? "ring-4 ring-green-500 scale-[1.02] shadow-lg"
                      : isComplete
                      ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                      : ""
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-8 lx:gap-12 justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {isComplete && (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          )}
                          <h3 className="font-semibold text-sm md:text-md">
                            {item.product_name}
                          </h3>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-blue-500 flex items-center gap-2">
                          <Badge variant="outline">SKU:</Badge> {item.sku}
                        </p>
                        {item.upc && (
                          <p className="text-xs text-gray-500">
                            UPC: {item.upc}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <div
                          className={`text-xl md:text-3xl font-bold ${
                            counted > expected
                              ? "text-orange-600"
                              : counted === expected
                              ? "text-green-600"
                              : "text-gray-900 dark:text-gray-100"
                          }`}
                        >
                          {counted}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          of {expected}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleManualAdjust(item.sku, -1)}
                        disabled={counted === 0}
                      >
                        -
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleManualAdjust(item.sku, 1)}
                      >
                        +
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Proceed to review */}
        <Card className="mt-auto block">
          <div className="max-w-6xl mx-auto p-4 flex items-center justify-between">
            {/* Left side: totals */}
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <span className="text-gray-800 dark:text-white">
                  {itemsCounted}
                </span>{" "}
                / {po.line_items.length} SKUs counted
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <span className="text-gray-800 dark:text-white">
                  {totalScanned}
                </span>{" "}
                /{" "}
                {po.line_items.reduce((sum, i) => sum + i.quantity_ordered, 0)}{" "}
                units counted
              </div>
            </div>

            {/* Right side: action */}
            <Button
              onClick={handleDone}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Review & Submit
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // STEP 3: Review & Submit
  if (step === "review" && po) {
    const hasVariances = po.line_items.some(
      (item) => (tallyCounts[item.sku] || 0) !== item.quantity_ordered
    );

    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Review Counts</CardTitle>
              <p className="text-gray-600">
                Review your counts before submitting for approval
              </p>
            </CardHeader>
            <CardContent>
              {/* Summary */}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg mb-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-3xl font-bold text-blue-600">
                      {po.line_items.length}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Total SKUs
                    </div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-blue-600">
                      {totalScanned}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Units Counted
                    </div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-blue-600">
                      {itemsCounted}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      SKUs Counted
                    </div>
                  </div>
                </div>
              </div>

              {/* Variance Warning */}
              {hasVariances && (
                <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6 dark:bg-amber-900/20 dark:text-yellow-400">
                  <div className="flex items-center">
                    <AlertCircle className="w-5 h-5 text-yellow-500 mr-3" />
                    <p className="text-yellow-700 font-medium">
                      Some items have count variances from expected quantities
                    </p>
                  </div>
                </div>
              )}

              {/* Items Review */}
              <div className="space-y-3 mb-6">
                {po.line_items.map((item) => {
                  const counted = tallyCounts[item.sku] || 0;
                  const expected = item.quantity_ordered;
                  const variance = counted - expected;

                  return (
                    <div
                      key={item.sku}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-800 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          SKU: {item.sku}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-4">
                          <div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              Expected
                            </div>
                            <div className="font-semibold">{expected}</div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              Counted
                            </div>
                            <div
                              className={`font-semibold ${
                                variance !== 0 ? "text-orange-600" : ""
                              }`}
                            >
                              {counted}
                            </div>
                          </div>
                          {variance !== 0 && (
                            <Badge
                              variant={variance > 0 ? "default" : "destructive"}
                            >
                              {variance > 0 ? "+" : ""}
                              {variance}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Approver Selection */}
              <div className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <Label
                  htmlFor="approver"
                  className="text-base font-semibold mb-2 block"
                >
                  Assign Approver
                </Label>
                <Select
                  value={selectedApprover}
                  onValueChange={setSelectedApprover}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select who should approve this receiving" />
                  </SelectTrigger>
                  <SelectContent>
                    {approvers.map((approver) => (
                      <SelectItem key={approver.id} value={approver.id}>
                        <div className="flex items-center justify-between w-full">
                          <span className="font-medium">
                            {approver.name || approver.email}
                          </span>
                          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                            ({approver.role})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {approvers.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Loading approvers...
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleBackToScanning}
                  disabled={submitMutation.isPending}
                  className="flex-1"
                >
                  Back to Scanning
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={submitMutation.isPending}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {submitMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Submit for Approval
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return null;
}
