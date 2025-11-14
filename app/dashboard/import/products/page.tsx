"use client";

import React, { useState, useCallback } from "react";
import {
  Upload,
  Download,
  Package,
  AlertCircle,
  CheckCircle,
  Loader2,
  Box,
  Database,
  Dumbbell,
} from "lucide-react";

import {
  CSVRow,
  Dimensions,
  Weight,
  ParsedProduct,
  ProductGroup,
  FileDropZoneProps,
} from "@/types/import-data";

const EnhancedProductImportInterface = (props: {
  params: Promise<{}>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [rawData, setRawData] = useState<Record<string, string>[]>([]);
  const [parsedProducts, setParsedProducts] = useState<ProductGroup>({});
  const [selectedProducts, setSelectedProducts] = useState<
    Record<string, boolean>
  >({});

  const [importProgress, setImportProgress] = useState({
    current: 0,
    total: 0,
  });

  const parseCSV = (csvText: string): CSVRow[] => {
    const lines = csvText.trim().split("\n");
    const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));

    return lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));
      const row: CSVRow = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });
      return row;
    });
  };

  const parseDimensions = (dimensionStr: string): Dimensions | null => {
    if (!dimensionStr) return null;
    const parts = dimensionStr.split(" x ");
    if (parts.length !== 3) return null;

    return {
      length: parseFloat(parts[0]),
      width: parseFloat(parts[1]),
      height: parseFloat(parts[2].replace(" in", "")),
    };
  };

  const parseWeight = (weightStr: string): Weight | null => {
    if (!weightStr) return null;
    const numMatch = weightStr.match(/[\d.]+/);
    const unit: "oz" | "lbs" = weightStr.includes("lbs") ? "lbs" : "oz";
    return numMatch ? { value: parseFloat(numMatch[0]), unit } : null;
  };

  const parseEnhancedProduct = (row: CSVRow): ParsedProduct => {
    const baseProduct = `${row.NAME} ${row.CATEGORY}`;
    const brand = "Skwezed";

    const mcDimensions = parseDimensions(row["MC DIMENSION"]);
    const mcWeight = parseWeight(row["MC WEIGHT"]);
    const singleDimensions = parseDimensions(row["SINGLE DIMENSION"]);
    const singleWeight = parseWeight(row["SINGLE WEIGHT"]);

    return {
      baseProduct,
      flavor: row.NAME,
      productLine: row.CATEGORY,
      brand,
      fullName: row.PRODUCT,
      sku: row.SKU,
      upc: row.UPC.toString(),
      volume: row.VOLUME,
      strength: row.STRENGTH,
      singleWeight,
      singleDimensions,
      masterCase: {
        qty: row["MC QTY"],
        weight: mcWeight,
        dimensions: mcDimensions,
      },
      category: "E-Liquid",
      hasIce: row.CATEGORY.includes("ICE"),
      hasSalt: row.CATEGORY.includes("Salt"),
      isNicotineFree: row.STRENGTH === "00mg",
      reorderPoint: 50, // <-- DEFAULT HERE
    };
  };

  const handleCSVUpload = useCallback((file: File) => {
    setLoading(true);
    setError("");
    setSuccess("");

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const text = e.target?.result;
        if (typeof text !== "string") {
          throw new Error("Invalid file content");
        }

        const csvData: CSVRow[] = parseCSV(text);

        const requiredColumns = [
          "PRODUCT",
          "UPC",
          "SKU",
          "NAME",
          "CATEGORY",
          "VOLUME",
          "STRENGTH",
        ];

        const hasAllColumns = requiredColumns.every((col) =>
          csvData[0]?.hasOwnProperty(col)
        );

        if (!hasAllColumns) {
          throw new Error(
            `CSV must contain columns: ${requiredColumns.join(", ")}`
          );
        }

        setRawData(csvData);

        // Parse into products
        const parsed: ParsedProduct[] = csvData.map((row) =>
          parseEnhancedProduct(row)
        );

        // Group by baseProduct
        const groupedProducts: Record<string, ParsedProduct[]> = parsed.reduce(
          (acc, product) => {
            if (!acc[product.baseProduct]) {
              acc[product.baseProduct] = [];
            }
            acc[product.baseProduct].push(product);
            return acc;
          },
          {} as Record<string, ParsedProduct[]>
        );

        setParsedProducts(groupedProducts);

        // Initialize selection (all selected by default)
        const initialSelection: Record<string, boolean> = {};
        Object.keys(groupedProducts).forEach((key) => {
          initialSelection[key] = true;
        });
        setSelectedProducts(initialSelection);

        setSuccess(
          `Successfully parsed ${parsed.length} variants into ${
            Object.keys(groupedProducts).length
          } base products with master case data`
        );
        setStep(2);
        setLoading(false);
      } catch (err: any) {
        setError(`Error parsing CSV: ${err.message}`);
        setLoading(false);
      }
    };

    reader.readAsText(file);
  }, []);

  const toggleProductSelection = (productName: keyof typeof parsedProducts) => {
    setSelectedProducts((prev) => ({
      ...prev,
      [productName]: !prev[productName],
    }));
  };

  const importToDatabase = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    const selectedProductNames = Object.keys(selectedProducts).filter(
      (key) => selectedProducts[key]
    );
    const totalItems = selectedProductNames.length;
    setImportProgress({ current: 0, total: totalItems });

    try {
      for (let i = 0; i < selectedProductNames.length; i++) {
        const baseProductName = selectedProductNames[i];
        const variants = parsedProducts[baseProductName];
        const firstVariant = variants[0];

        const productData = {
          sku: `${firstVariant.flavor.toUpperCase()}-${firstVariant.productLine
            .replace(/\s+/g, "-")
            .toUpperCase()}`,
          name: baseProductName,
          description: `${firstVariant.flavor} flavored e-liquid - ${firstVariant.productLine} series`,
          category: firstVariant.category,
          brand: firstVariant.brand,
          productLine: firstVariant.productLine,
          flavor: firstVariant.flavor,
        };

        const variantsData = variants.map((variant) => {
          const reorderPoint = 50; // default value

          const weightInGrams = variant.singleWeight
            ? variant.singleWeight.unit === "oz"
              ? variant.singleWeight.value * 28.35
              : variant.singleWeight.value * 453.592
            : null;

          const mcWeightInGrams = variant.masterCase.weight
            ? variant.masterCase.weight.unit === "lbs"
              ? variant.masterCase.weight.value * 453.592
              : variant.masterCase.weight.value * 28.35
            : null;

          const dimensions = {
            single: {
              weight: variant.singleWeight,
              dimensions: variant.singleDimensions,
            },
            masterCase: {
              qty: variant.masterCase.qty,
              weight: variant.masterCase.weight,
              dimensions: variant.masterCase.dimensions,
            },
            attributes: {
              volume: variant.volume,
              strength: variant.strength,
              has_ice: variant.hasIce,
              has_salt: variant.hasSalt,
              is_nicotine_free: variant.isNicotineFree,
              flavor: variant.flavor,
              product_line: variant.productLine,
            },
          };

          return {
            sku: variant.sku,
            upc: variant.upc,
            name: variant.fullName,
            category: variant.category,
            supplier: variant.brand,
            barcode: variant.upc,
            weight: weightInGrams,
            dimensions: dimensions,
            volume: variant.volume,
            strength: variant.strength,
            masterCaseQty: parseInt(variant.masterCase.qty),
            masterCaseWeight: mcWeightInGrams,
            masterCaseDimensions: variant.masterCase.dimensions,
            hasIce: variant.hasIce,
            hasSalt: variant.hasSalt,
            isNicotineFree: variant.isNicotineFree,
            flavor: variant.flavor,
            productLine: variant.productLine,
            reorderPoint, // <-- Reorder Point
          };
        });

        const response = await fetch("/api/products/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            product: productData,
            variants: variantsData,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || `Failed to import ${baseProductName}`
          );
        }

        setImportProgress({ current: i + 1, total: totalItems });
      }

      setSuccess(
        `Successfully imported ${totalItems} products with ${getTotalVariantCount()} variants to database!`
      );
      setStep(3);
      setLoading(false);
    } catch (err) {
      if (err instanceof Error) {
        setError(`Error parsing CSV: ${err.message}`);
      } else {
        setError("Unknown error parsing CSV");
      }
    }
  };

  const generateProductSQL = () => {
    const selectedProductNames = Object.keys(selectedProducts).filter(
      (key) => selectedProducts[key]
    );

    if (selectedProductNames.length === 0) return "";

    let sql = "-- Enhanced Product Import SQL Script\n";
    sql += `-- Generated on ${new Date().toISOString()}\n`;
    sql += `-- Importing ${selectedProductNames.length} base products with master case data\n\n`;

    sql += "-- Insert base products\n";
    selectedProductNames.forEach((baseProduct) => {
      const variants = parsedProducts[baseProduct];
      const firstVariant = variants[0];
      const productId = `prod_${firstVariant.flavor
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")}_${firstVariant.productLine
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")}`;
      const productSku = `${firstVariant.flavor.toUpperCase()}-${firstVariant.productLine
        .replace(/\s+/g, "-")
        .toUpperCase()}`;

      const description = `${firstVariant.flavor} flavored e-liquid - ${firstVariant.productLine} series`;

      sql += `INSERT INTO products (id, sku, name, description, category, brand, created_at, updated_at)\n`;
      sql += `VALUES ('${productId}', '${productSku}', '${baseProduct.replace(
        /'/g,
        "''"
      )}', '${description.replace(/'/g, "''")}', '${firstVariant.category}', '${
        firstVariant.brand
      }', NOW(), NOW());\n\n`;
    });

    sql += "\n-- Insert product variants with enhanced data\n";
    selectedProductNames.forEach((baseProduct) => {
      const variants = parsedProducts[baseProduct];
      const firstVariant = variants[0];
      const productId = `prod_${firstVariant.flavor
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")}_${firstVariant.productLine
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")}`;

      sql += `-- Variants for ${baseProduct}\n`;
      variants.forEach((variant) => {
        const variantId = `var_${variant.sku
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")}`;

        const dimensions = {
          volume: variant.volume,
          strength: variant.strength,
          weight: variant.singleWeight,
          dimensions: variant.singleDimensions,
          masterCase: variant.masterCase,
          has_ice: variant.hasIce,
          has_salt: variant.hasSalt,
          is_nicotine_free: variant.isNicotineFree,
          flavor: variant.flavor,
          product_line: variant.productLine,
        };

        const dimensionsJson = JSON.stringify(dimensions).replace(/"/g, '\\"');

        let weightInGrams = null;
        if (variant.singleWeight) {
          weightInGrams =
            variant.singleWeight.unit === "oz"
              ? (variant.singleWeight.value * 28.35).toFixed(2)
              : (variant.singleWeight.value * 453.592).toFixed(2);
        }

        sql += `INSERT INTO product_variants (\n`;
        sql += `  id, product_id, sku, upc, name, category, supplier, barcode,\n`;
        sql += `  weight, dimensions, created_at, updated_at\n`;
        sql += `) VALUES (\n`;
        sql += `  '${variantId}',\n`;
        sql += `  '${productId}',\n`;
        sql += `  '${variant.sku}',\n`;
        sql += `  '${variant.upc}',\n`;
        sql += `  '${variant.fullName.replace(/'/g, "''")}',\n`;
        sql += `  '${variant.category}',\n`;
        sql += `  '${variant.brand}',\n`;
        sql += `  '${variant.upc}',\n`;
        sql += `  ${weightInGrams ? weightInGrams : "NULL"},\n`;
        sql += `  '${dimensionsJson}',\n`;
        sql += `  NOW(),\n`;
        sql += `  NOW()\n`;
        sql += `);\n`;
      });
      sql += "\n";
    });

    return sql;
  };

  const downloadSQL = () => {
    const sql = generateProductSQL();
    const blob = new Blob([sql], { type: "text/sql" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `enhanced_products_import_${
      new Date().toISOString().split("T")[0]
    }.sql`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const FileDropZone: React.FC<FileDropZoneProps> = ({ onFileSelect }) => {
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
        <Upload className="mx-auto h-16 w-16 text-blue-400 mb-4" />
        <h3 className="text-xl font-medium text-gray-900 dark:text-gray-200 mb-2">
          Upload Product CSV
        </h3>
        <div className="text-gray-600 mb-4">
          <p className="mb-2">Expected columns:</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              "PRODUCT",
              "UPC",
              "SKU",
              "NAME",
              "CATEGORY",
              "VOLUME",
              "STRENGTH",
              "MC WEIGHT",
              "MC QTY",
              "MC DIMENSION",
              "SINGLE DIMENSION",
              "SINGLE WEIGHT",
            ].map((col) => (
              <span
                key={col}
                className="font-mono bg-gray-200 dark:bg-zinc-800 dark:text-gray-400 px-2 py-1 rounded"
              >
                {col}
              </span>
            ))}
          </div>
        </div>
        <label className="bg-blue-500 text-white px-6 py-3 rounded-md cursor-pointer hover:bg-blue-600 inline-block">
          Choose CSV File
          <input
            type="file"
            accept=".csv"
            onChange={handleFileInput}
            className="hidden"
          />
        </label>
        <p className="text-sm text-gray-500 mt-2">
          Supports master case and unit-level data
        </p>
      </div>
    );
  };

  const getSelectedCount = () => {
    return Object.values(selectedProducts).filter(Boolean).length;
  };

  const getTotalVariantCount = () => {
    return Object.keys(selectedProducts)
      .filter((key) => selectedProducts[key])
      .reduce(
        (total, productName) => total + parsedProducts[productName].length,
        0
      );
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-background min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
          <Package className="mr-3 h-8 w-8 text-blue-600" />
          Product Import
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Import products with master case data directly to database
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
          <span>Review & Select</span>
          <span>Import Complete</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 mb-6">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
            <div className="ml-3">
              <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4 mb-6">
          <div className="flex">
            <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
            <div className="ml-3">
              <p className="text-sm text-green-800 dark:text-green-400">
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
                Processing enhanced CSV...
              </span>
            </div>
          )}
        </div>
      )}

      {step === 2 && Object.keys(parsedProducts).length > 0 && (
        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Review Products for Import
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm dark:text-gray-300">
              <div>
                <strong>{Object.keys(parsedProducts).length}</strong> base
                products
              </div>
              <div>
                <strong>{Object.values(parsedProducts).flat().length}</strong>{" "}
                total variants
              </div>
              <div>
                Includes <Box className="inline h-4 w-4" /> master case &{" "}
                <Dumbbell className="inline h-4 w-4" /> weight data
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Selected: <strong>{getSelectedCount()}</strong> products,{" "}
              <strong>{getTotalVariantCount()}</strong> variants
            </div>
            <div className="space-x-2">
              <button
                onClick={() => {
                  const allSelected: Record<string, boolean> = {};
                  Object.keys(parsedProducts).forEach((key: string) => {
                    allSelected[key] = true;
                  });
                  setSelectedProducts(allSelected);
                }}
                className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Select All
              </button>
              <button
                onClick={() => setSelectedProducts({})}
                className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Clear All
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
            {Object.entries(parsedProducts).map(
              ([productName, variants]: [string, ParsedProduct[]]) => {
                const sample = variants[0];
                return (
                  <div
                    key={productName}
                    className={`border rounded-lg p-4 ${
                      selectedProducts[productName]
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                    }`}
                  >
                    <label className="flex items-start cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedProducts[productName] || false}
                        onChange={() => toggleProductSelection(productName)}
                        className="mt-1 mr-3 h-4 w-4 text-blue-600 rounded"
                      />
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                          {productName}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {variants.length} variants
                        </p>

                        <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                          <div className="flex items-center">
                            <Box className="h-3 w-3 mr-1" />
                            MC: {sample.masterCase.qty} units
                          </div>
                          <div className="flex items-center">
                            <Dumbbell className="h-3 w-3 mr-1" />
                            {sample.singleWeight?.value}
                            {sample.singleWeight?.unit} each
                          </div>
                        </div>

                        <div className="mt-2 space-y-1">
                          {variants.slice(0, 2).map((variant, idx) => (
                            <div
                              key={idx}
                              className="text-xs text-gray-600 dark:text-gray-400"
                            >
                              • {variant.sku} ({variant.volume}{" "}
                              {variant.strength})
                            </div>
                          ))}
                          {variants.length > 2 && (
                            <div className="text-xs text-gray-400">
                              + {variants.length - 2} more...
                            </div>
                          )}
                        </div>
                      </div>
                    </label>
                  </div>
                );
              }
            )}
          </div>

          {loading && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Importing to database...
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
            <div className="flex space-x-3">
              <button
                onClick={downloadSQL}
                disabled={getSelectedCount() === 0}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
              >
                <Download className="h-4 w-4 mr-2" />
                Download SQL
              </button>
              <button
                onClick={importToDatabase}
                disabled={getSelectedCount() === 0 || loading}
                className="px-6 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
              >
                <Database className="h-4 w-4 mr-2" />
                Import to Database ({getSelectedCount()})
              </button>
            </div>
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
              Successfully imported <strong>{getSelectedCount()}</strong>{" "}
              products with <strong>{getTotalVariantCount()}</strong> variants
              to your database.
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
              What was imported:
            </h3>
            <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
              <li>
                ✅ Base products with brand, category, flavor, and product line
              </li>
              <li>✅ Product variants with SKU, UPC, and barcode</li>
              <li>✅ Master case quantities, weights, and dimensions</li>
              <li>✅ Single unit weights and dimensions</li>
              <li>✅ Product attributes (ICE, Salt, Nicotine-free flags)</li>
            </ul>
          </div>

          <div className="flex justify-center space-x-4">
            <button
              onClick={() => {
                setStep(1);
                setRawData([]);
                setParsedProducts({});
                setSelectedProducts({});
                setError("");
                setSuccess("");
              }}
              className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Import Another File
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedProductImportInterface;
