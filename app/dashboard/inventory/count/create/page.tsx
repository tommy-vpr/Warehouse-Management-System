"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Package,
  Settings,
  Save,
  AlertCircle,
  Info,
  Search, // ✅ Add this
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import SpinningLoader from "@/components/SpinningLoader";

interface Location {
  id: string;
  name: string;
  zone?: string;
  aisle?: string;
  shelf?: string;
  bin?: string;
}

export default function CreateCampaign(props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const productVariantId = searchParams.get("product");

  // ✅ Add location search state
  const [locationSearch, setLocationSearch] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    countType: "PARTIAL",
    startDate: "",
    endDate: "",
    locationIds: [] as string[],
    zoneFilter: "",
    lastCountedBefore: "",
    abcClass: "",
    tolerancePercentage: "5.0",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Add this query to fetch product data
  const { data: productVariant } = useQuery({
    queryKey: ["product-variant", productVariantId],
    queryFn: async () => {
      if (!productVariantId) return null;

      const response = await fetch(
        `/api/products/variants/${productVariantId}`
      );
      if (!response.ok) {
        throw new Error("Failed to load product");
      }
      return response.json();
    },
    enabled: !!productVariantId, // Only run if productVariantId exists
    staleTime: 300000,
  });

  console.log(productVariant);

  // Fetch locations
  const { data: locations = [], isLoading } = useQuery<Location[]>({
    queryKey: ["cycle-count-locations", productVariantId],
    queryFn: async () => {
      let url = "/api/inventory/cycle-counts/locations";
      if (productVariantId) {
        url += `?productVariantId=${encodeURIComponent(productVariantId)}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to load locations");
      }
      return response.json();
    },
    staleTime: 300000, // 5 minutes - locations don't change often
  });

  // ✅ Filter locations based on search
  const filteredLocations = useMemo(() => {
    if (!locationSearch.trim()) {
      return locations;
    }

    const search = locationSearch.toLowerCase();
    return locations.filter(
      (location) =>
        location.name.toLowerCase().includes(search) ||
        location.zone?.toLowerCase().includes(search) ||
        location.aisle?.toLowerCase().includes(search) ||
        location.bin?.toLowerCase().includes(search)
    );
  }, [locations, locationSearch]);

  // Create campaign mutation
  const createCampaignMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch("/api/inventory/cycle-counts/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          locationIds: data.locationIds.length > 0 ? data.locationIds : null,
          lastCountedBefore: data.lastCountedBefore || null,
          endDate: data.endDate || null,
          tolerancePercentage: parseFloat(data.tolerancePercentage),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create campaign");
      }

      return response.json();
    },
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: ["cycle-count-campaigns"] });

      toast({
        title: "Campaign Created",
        description: `"${formData.name}" was created successfully.`,
        variant: "success",
      });

      router.push(`/dashboard/inventory/count`);
    },
    onError: (error: Error) => {
      setErrors({ submit: error.message });
    },
  });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Campaign name is required";
    }

    if (!formData.countType) {
      newErrors.countType = "Count type is required";
    }

    if (!formData.startDate) {
      newErrors.startDate = "Start date is required";
    }

    if (formData.endDate) {
      const start = new Date(formData.startDate).setHours(0, 0, 0, 0);
      const end = new Date(formData.endDate).setHours(0, 0, 0, 0);

      if (isNaN(end)) {
        newErrors.endDate = "Invalid end date";
      } else if (end < start) {
        newErrors.endDate = "End date must be after start date";
      }
    }

    if (
      formData.countType === "PARTIAL" &&
      formData.locationIds.length === 0 &&
      !formData.zoneFilter
    ) {
      newErrors.locations =
        "Select locations or specify a zone for partial counts";
    }

    if (formData.zoneFilter && formData.locationIds.length > 0) {
      newErrors.locations =
        "Choose either a zone filter OR specific locations, not both";
    }

    const tolerance = parseFloat(formData.tolerancePercentage);
    if (isNaN(tolerance) || tolerance < 0 || tolerance > 100) {
      newErrors.tolerancePercentage = "Tolerance must be between 0 and 100";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    createCampaignMutation.mutate(formData);
  };

  const handleLocationToggle = (locationId: string) => {
    setFormData((prev) => ({
      ...prev,
      locationIds: prev.locationIds.includes(locationId)
        ? prev.locationIds.filter((id) => id !== locationId)
        : [...prev.locationIds, locationId],
    }));
  };

  const getCountTypeInfo = (type: string) => {
    const info = {
      FULL: "Count all inventory items across all locations",
      PARTIAL: "Count specific items or locations",
      ABC_ANALYSIS: "Count items based on ABC classification",
      FAST_MOVING: "Count high-velocity items",
      SLOW_MOVING: "Count low-velocity items",
      NEGATIVE_STOCK: "Count items showing negative quantities",
      ZERO_STOCK: "Count items showing zero quantities",
      HIGH_VALUE: "Count high-dollar-value items",
    };
    return info[type as keyof typeof info] || "";
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard/inventory/count")}
            className="mr-4"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Create Cycle Count Campaign
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              {productVariant.name || productVariant.sku}
              {/* Set up a new inventory counting campaign
              {productVariantId && productVariant && (
                <Badge variant="outline" className="ml-2 text-sm">
                  {productVariant.name || productVariant.sku}
                </Badge>
              )} */}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="w-5 h-5 mr-2" />
                Campaign Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-2">
                    Campaign Name *
                  </label>
                  <Input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="e.g., Q1 2024 ABC Count"
                    className={errors.name ? "border-red-500" : ""}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-600 mt-1">{errors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-2">
                    Count Type *
                  </label>
                  <select
                    value={formData.countType}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        countType: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:text-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="FULL">Full Count</option>
                    <option value="PARTIAL">Partial Count</option>
                    <option value="ABC_ANALYSIS">ABC Analysis</option>
                    <option value="FAST_MOVING">Fast Moving</option>
                    <option value="SLOW_MOVING">Slow Moving</option>
                    <option value="NEGATIVE_STOCK">Negative Stock</option>
                    <option value="ZERO_STOCK">Zero Stock</option>
                    <option value="HIGH_VALUE">High Value</option>
                  </select>
                  {formData.countType && (
                    <p className="text-sm text-gray-600 mt-1 flex items-start">
                      <Info className="w-4 h-4 mr-1 mt-0.5 flex-shrink-0" />
                      {getCountTypeInfo(formData.countType)}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Optional description or special instructions..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </CardContent>
          </Card>

          {/* Schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-2">
                    Start Date *
                  </label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        startDate: e.target.value,
                      }))
                    }
                    min={new Date().toISOString().split("T")[0]}
                    className={errors.startDate ? "border-red-500" : ""}
                  />
                  {errors.startDate && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.startDate}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-2">
                    End Date (Optional)
                  </label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        endDate: e.target.value,
                      }))
                    }
                    min={formData.startDate}
                    className={errors.endDate ? "border-red-500" : ""}
                  />
                  {errors.endDate && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.endDate}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Criteria */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Package className="w-5 h-5 mr-2" />
                Count Criteria
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-2">
                    Zone Filter
                  </label>
                  <Input
                    value={formData.zoneFilter}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        zoneFilter: e.target.value,
                      }))
                    }
                    placeholder="e.g., Zone A, Receiving"
                  />
                  <p className="text-sm text-gray-600 mt-1">
                    Count all items in specific zones
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-2">
                    Last Counted Before
                  </label>
                  <Input
                    type="date"
                    value={formData.lastCountedBefore}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        lastCountedBefore: e.target.value,
                      }))
                    }
                  />
                  <p className="text-sm text-gray-600 mt-1">
                    Items not counted since this date
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-2">
                    ABC Class
                  </label>
                  <select
                    value={formData.abcClass}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        abcClass: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 dark:text-gray-400  border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Classes</option>
                    <option value="A">Class A (High Value)</option>
                    <option value="B">Class B (Medium Value)</option>
                    <option value="C">Class C (Low Value)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-2">
                    Tolerance Percentage
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formData.tolerancePercentage}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        tolerancePercentage: String(
                          Math.max(
                            0,
                            Math.min(100, parseFloat(e.target.value) || 0)
                          )
                        ),
                      }))
                    }
                    className={
                      errors.tolerancePercentage ? "border-red-500" : ""
                    }
                  />
                  {errors.tolerancePercentage && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.tolerancePercentage}
                    </p>
                  )}
                  <p className="text-sm text-gray-600 mt-1">
                    Variance threshold for recount requirement
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Location Selection */}
          {(formData.countType === "PARTIAL" ||
            formData.countType === "FULL") && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center">
                    <MapPin className="w-5 h-5 mr-2" />
                    Locations
                  </span>
                  <Badge variant="outline">
                    {formData.locationIds.length} selected
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* ✅ Search Input */}
                <div className="mb-4 space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search locations by name, zone, aisle..."
                      value={locationSearch}
                      onChange={(e) => setLocationSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          locationIds: filteredLocations.map((l) => l.id),
                        }))
                      }
                    >
                      Select {locationSearch ? "Filtered" : "All"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, locationIds: [] }))
                      }
                    >
                      Clear All
                    </Button>
                  </div>

                  {/* ✅ Results counter */}
                  {locationSearch && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Showing {filteredLocations.length} of {locations.length}{" "}
                      locations
                    </p>
                  )}
                </div>

                {isLoading ? (
                  <SpinningLoader />
                ) : filteredLocations.length === 0 ? (
                  /* ✅ No results message */
                  <div className="text-center py-8 text-gray-500">
                    <MapPin className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">
                      {locationSearch
                        ? "No locations match your search"
                        : "No locations available"}
                    </p>
                    {locationSearch && (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={() => setLocationSearch("")}
                        className="mt-2"
                      >
                        Clear search
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                    {filteredLocations.map((location) => (
                      <div
                        key={location.id}
                        className={`p-3 border rounded-md cursor-pointer transition-colors ${
                          formData.locationIds.includes(location.id)
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-800/30"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                        onClick={() => handleLocationToggle(location.id)}
                      >
                        <div className="text-sm font-medium">
                          {location.name}
                        </div>
                        {(location.zone || location.aisle) && (
                          <div className="text-xs text-gray-600 dark:text-blue-500">
                            {location.zone && `Zone: ${location.zone}`}
                            {location.zone && location.aisle && " • "}
                            {location.aisle && `Aisle: ${location.aisle}`}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {errors.locations && (
                  <p className="text-sm text-red-600 mt-2">
                    {errors.locations}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Error Display */}
          {errors.submit && (
            <Card className="border-red-200">
              <CardContent className="p-4">
                <div className="flex items-center text-red-600">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  {errors.submit}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/inventory/count")}
              disabled={createCampaignMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createCampaignMutation.isPending}>
              {createCampaignMutation.isPending ? (
                "Creating..."
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Create Campaign
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
