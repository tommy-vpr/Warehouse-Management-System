// app/api/products/import/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { product, variants } = body;

    // Validate required data
    if (!product || !variants || variants.length === 0) {
      return NextResponse.json(
        { error: "Product and variants data are required" },
        { status: 400 }
      );
    }

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Check if product already exists
      let existingProduct = await tx.product.findUnique({
        where: { sku: product.sku },
      });

      let createdProduct;

      if (existingProduct) {
        // Update existing product
        createdProduct = await tx.product.update({
          where: { sku: product.sku },
          data: {
            name: product.name,
            description: product.description,
            category: product.category,
            brand: product.brand,
            productLine: product.productLine,
            flavor: product.flavor,
          },
        });
      } else {
        // Create new product
        createdProduct = await tx.product.create({
          data: {
            sku: product.sku,
            name: product.name,
            description: product.description,
            category: product.category,
            brand: product.brand,
            productLine: product.productLine,
            flavor: product.flavor,
          },
        });
      }

      // Process variants
      const createdVariants = [];
      for (const variant of variants) {
        // Check if variant exists
        const existingVariant = await tx.productVariant.findUnique({
          where: { sku: variant.sku },
        });

        if (existingVariant) {
          // Update existing variant
          const updatedVariant = await tx.productVariant.update({
            where: { sku: variant.sku },
            data: {
              productId: createdProduct.id,
              upc: variant.upc,
              name: variant.name,
              category: variant.category,
              supplier: variant.supplier,
              barcode: variant.barcode,
              weight: variant.weight,
              dimensions: variant.dimensions,
              volume: variant.volume,
              strength: variant.strength,
              masterCaseQty: variant.masterCaseQty,
              masterCaseWeight: variant.masterCaseWeight,
              masterCaseDimensions: variant.masterCaseDimensions,
              hasIce: variant.hasIce,
              hasSalt: variant.hasSalt,
              isNicotineFree: variant.isNicotineFree,
              flavor: variant.flavor,
              productLine: variant.productLine,
            },
          });
          createdVariants.push(updatedVariant);
        } else {
          // Create new variant
          const newVariant = await tx.productVariant.create({
            data: {
              productId: createdProduct.id,
              sku: variant.sku,
              upc: variant.upc,
              name: variant.name,
              category: variant.category,
              supplier: variant.supplier,
              barcode: variant.barcode,
              weight: variant.weight,
              dimensions: variant.dimensions,
              volume: variant.volume,
              strength: variant.strength,
              masterCaseQty: variant.masterCaseQty,
              masterCaseWeight: variant.masterCaseWeight,
              masterCaseDimensions: variant.masterCaseDimensions,
              hasIce: variant.hasIce,
              hasSalt: variant.hasSalt,
              isNicotineFree: variant.isNicotineFree,
              flavor: variant.flavor,
              productLine: variant.productLine,
            },
          });
          createdVariants.push(newVariant);
        }
      }

      return {
        product: createdProduct,
        variants: createdVariants,
      };
    });

    return NextResponse.json(
      {
        success: true,
        message: `Successfully imported product with ${result.variants.length} variants`,
        data: result,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Product import error:", error);

    // Handle specific Prisma errors
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Duplicate SKU or UPC detected" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to import product" },
      { status: 500 }
    );
  }
}

// Optional: GET endpoint to check import status or retrieve products
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sku = searchParams.get("sku");

    if (sku) {
      const product = await prisma.product.findUnique({
        where: { sku },
        include: {
          variants: true,
        },
      });

      if (!product) {
        return NextResponse.json(
          { error: "Product not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ product }, { status: 200 });
    }

    // Return summary of all products
    const productCount = await prisma.product.count();
    const variantCount = await prisma.productVariant.count();

    return NextResponse.json(
      {
        summary: {
          totalProducts: productCount,
          totalVariants: variantCount,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error fetching products:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch products" },
      { status: 500 }
    );
  }
}
