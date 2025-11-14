// app/api/inventory/product/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Warehouse } from "lucide-react";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get product variant with all related data
    const productVariant = await prisma.productVariant.findUnique({
      where: { id },
      include: {
        product: true,
        inventory: {
          include: {
            location: true,
          },
        },
        inventoryTransactions: {
          include: {
            user: {
              select: { id: true, name: true },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!productVariant) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Calculate aggregated quantities
    const totalQuantity = productVariant.inventory.reduce(
      (sum, inv) => sum + inv.quantityOnHand,
      0
    );
    const totalReserved = productVariant.inventory.reduce(
      (sum, inv) => sum + inv.quantityReserved,
      0
    );
    const totalAvailable = totalQuantity - totalReserved;

    // Determine reorder status
    let reorderStatus = "OK";
    const reorderPoint = productVariant.inventory[0]?.reorderPoint || 0;
    const maxQuantity = productVariant.inventory[0]?.maxQuantity || 0;

    if (totalAvailable <= 0) {
      reorderStatus = "CRITICAL";
    } else if (reorderPoint && totalAvailable <= reorderPoint) {
      reorderStatus = "LOW";
    } else if (maxQuantity && totalQuantity >= maxQuantity) {
      reorderStatus = "OVERSTOCK";
    }

    // Format locations
    const locations = productVariant.inventory.map((inv) => ({
      id: inv.location.id, // ← Use location.id, not inv.id
      inventoryId: inv.id, // Keep this if needed elsewhere
      name: inv.location.name,
      type: inv.location.type || "GENERAL",
      bay: inv.location.bay,
      space: inv.location.space,
      tier: inv.location.tier,
      aisle: inv.location.aisle,
      shelf: inv.location.shelf,
      bin: inv.location.bin,
      warehouse: inv.location.warehouseNumber,
      quantity: inv.quantityOnHand,
      isPickable: inv.location.isPickable,
      isReceivable: inv.location.isReceivable,
      lastCounted: inv.lastCounted?.toISOString(),
    }));

    // Format recent transactions
    const recentTransactions = productVariant.inventoryTransactions.map(
      (trans) => ({
        id: trans.id,
        type: trans.transactionType,
        quantityChange: trans.quantityChange,
        referenceId: trans.referenceId,
        referenceType: trans.referenceType,
        userId: trans.userId,
        userName: trans.user?.name,
        notes: trans.notes,
        createdAt: trans.createdAt.toISOString(),
      })
    );

    // Calculate analytics (you may want to implement more sophisticated calculations)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentSales = productVariant.inventoryTransactions.filter(
      (t) => t.transactionType === "SALE" && t.createdAt >= thirtyDaysAgo
    );

    const monthlyMovement = Math.abs(
      recentSales.reduce((sum, t) => sum + t.quantityChange, 0)
    );

    const lastSale = productVariant.inventoryTransactions.find(
      (t) => t.transactionType === "SALE"
    );
    const daysSinceLastSale = lastSale
      ? Math.floor(
          (Date.now() - lastSale.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        )
      : 999;

    const costPrice = productVariant.costPrice?.toNumber() || 0;
    const sellingPrice = productVariant.sellingPrice?.toNumber() || 0;
    const totalValue = costPrice * totalQuantity;
    const profitMargin =
      sellingPrice && costPrice
        ? ((sellingPrice - costPrice) / sellingPrice) * 100
        : null;

    const analytics = {
      monthlyMovement,
      averageVelocity: monthlyMovement / 30,
      turnoverRate: totalQuantity > 0 ? monthlyMovement / totalQuantity : 0,
      daysSinceLastSale,
      totalValue,
      profitMargin,
    };

    // Format the response to match your component's expectations
    const productDetails = {
      id: productVariant.id,
      productId: productVariant.productId,
      sku: productVariant.sku,
      upc: productVariant.upc,
      name: productVariant.name,
      description: productVariant.product.description,
      costPrice: productVariant.costPrice?.toNumber(),
      sellingPrice: productVariant.sellingPrice?.toNumber(),
      weight: productVariant.weight?.toNumber(),
      dimensions: productVariant.dimensions as any, // JSON field
      volume: productVariant.volume,
      strength: productVariant.strength,
      category: "GENERAL", // You may want to add this field to your schema
      supplier: "Unknown", // You may want to add this field to your schema
      shopifyVariantId: productVariant.shopifyVariantId,
      totalQuantity,
      totalReserved,
      totalAvailable,
      reorderPoint: productVariant.inventory[0]?.reorderPoint,
      maxQuantity: productVariant.inventory[0]?.maxQuantity,
      reorderStatus,
      locations,
      recentTransactions,
      analytics,
    };

    return NextResponse.json(productDetails);
  } catch (error) {
    console.error("Error fetching product details:", error);
    return NextResponse.json(
      { error: "Failed to fetch product details" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const updates = await request.json();

    // Update the product variant
    const updatedVariant = await prisma.productVariant.update({
      where: { id },
      data: {
        name: updates.name,
        upc: updates.upc,
        costPrice: updates.costPrice,
        sellingPrice: updates.sellingPrice,
        weight: updates.weight,
        // Note: category and supplier would need to be added to schema
      },
    });

    // Update product description if provided
    if (updates.description) {
      await prisma.product.update({
        where: { id: updatedVariant.productId },
        data: { description: updates.description },
      });
    }

    // Update reorder settings for all inventory locations
    if (
      updates.reorderPoint !== undefined ||
      updates.maxQuantity !== undefined
    ) {
      await prisma.inventory.updateMany({
        where: { productVariantId: id },
        data: {
          ...(updates.reorderPoint !== undefined && {
            reorderPoint: updates.reorderPoint,
          }),
          ...(updates.maxQuantity !== undefined && {
            maxQuantity: updates.maxQuantity,
          }),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating product:", error);
    return NextResponse.json(
      { error: "Failed to update product" },
      { status: 500 }
    );
  }
}

// app/api/inventory/transactions/route.ts
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      productVariantId,
      transactionType,
      quantityChange,
      locationId,
      notes,
      referenceType,
    } = await request.json();

    // Create the transaction
    await prisma.inventoryTransaction.create({
      data: {
        productVariantId,
        locationId,
        transactionType,
        quantityChange,
        referenceType,
        userId: session.user.id,
        notes,
      },
    });

    // Update inventory quantities
    if (locationId) {
      // Update specific location
      await prisma.inventory.update({
        where: {
          productVariantId_locationId: {
            productVariantId,
            locationId,
          },
        },
        data: {
          quantityOnHand: {
            increment: quantityChange,
          },
        },
      });
    } else {
      // Update first available location (or create logic for distributing across locations)
      const firstInventory = await prisma.inventory.findFirst({
        where: { productVariantId },
      });

      if (firstInventory) {
        await prisma.inventory.update({
          where: { id: firstInventory.id },
          data: {
            quantityOnHand: {
              increment: quantityChange,
            },
          },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error creating transaction:", error);
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  }
}
