// app/aip / pick - lists / [id] / items / [itemId] / pick / route.ts;
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const body = await req.json();
  const { quantityPicked, userId, scannedCode, notes } = body;

  const { id, itemId } = await params;

  const item = await prisma.pickListItem.findUnique({
    where: { id: itemId },
    include: { productVariant: true, location: true },
  });

  if (!item) {
    return NextResponse.json(
      { error: "Pick list item not found" },
      { status: 404 }
    );
  }

  // Validate scanned code
  const isValidScan =
    scannedCode === item.productVariant.sku ||
    scannedCode === item.productVariant.upc ||
    scannedCode === item.productVariant.barcode ||
    scannedCode === item.location.barcode;

  if (!isValidScan) {
    return NextResponse.json(
      { error: "Invalid scan - code does not match product or location" },
      { status: 400 }
    );
  }

  // Update item
  const newQuantityPicked = item.quantityPicked + quantityPicked;
  const isComplete = newQuantityPicked >= item.quantityToPick;
  const isShortPick =
    newQuantityPicked < item.quantityToPick && quantityPicked > 0;

  const updatedItem = await prisma.pickListItem.update({
    where: { id: itemId },
    data: {
      quantityPicked: newQuantityPicked,
      status: isComplete ? "PICKED" : isShortPick ? "SHORT_PICK" : "PENDING",
      pickedBy: userId,
      pickedAt: isComplete ? new Date() : null,
      ...(isShortPick && notes && { shortPickReason: notes }),
    },
  });

  // Update pick list progress
  const pickList = await prisma.pickList.findUnique({
    where: { id },
    include: { items: true },
  });

  const totalPicked = pickList!.items.filter(
    (i) => i.status === "PICKED"
  ).length;

  await prisma.pickList.update({
    where: { id },
    data: {
      pickedItems: totalPicked,
      status:
        totalPicked === pickList!.totalItems ? "COMPLETED" : "IN_PROGRESS",
    },
  });

  // Create pick event
  await prisma.pickEvent.create({
    data: {
      pickListId: id,
      itemId: itemId,
      eventType: isShortPick ? "ITEM_SHORT_PICKED" : "ITEM_PICKED",
      userId,
      scannedCode,
      location: item.location.name,
      notes,
      data: {
        quantityPicked,
        totalPicked: newQuantityPicked,
        quantityRequired: item.quantityToPick,
        sku: item.productVariant.sku,
      },
    },
  });

  // Update inventory
  await prisma.inventory.update({
    where: {
      productVariantId_locationId: {
        productVariantId: item.productVariantId,
        locationId: item.locationId,
      },
    },
    data: {
      quantityOnHand: { decrement: quantityPicked },
      quantityReserved: { decrement: quantityPicked },
    },
  });

  return NextResponse.json({
    item: updatedItem,
    isComplete,
    isShortPick,
    pickList: { id, pickedItems: totalPicked },
  });
}
