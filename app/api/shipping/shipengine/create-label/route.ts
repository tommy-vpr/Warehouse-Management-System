import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { InventoryReservation, Prisma } from "@prisma/client";
import { updateOrderStatus } from "@/lib/order-status-helper";

import {
  updateShopifyFulfillment,
  getShopifyCarrierName,
} from "@/lib/shopify-fulfillment";

import {
  getOrCreateShippingTask,
  logCarrierSelected,
  logPackageWeighed,
  logPackageDimensions,
  logLabelGenerated,
  logBatchLabelsGenerated,
  completeShippingTask,
} from "@/lib/shipping-audit";

import {
  queuePackingSlipGeneration,
  queueShopifyFulfillment,
  queueShipmentNotification,
} from "@/lib/queues/shipment-queue"; // ✅ Use .local

type ReleasedReservationSummary = {
  productVariantId: string;
  quantityReleased: number;
};

type BackOrderFulfilledSummary = {
  productVariantId: string;
  quantityBackOrdered: number;
};

type PackageInput = {
  weight: number;
  length?: number;
  width?: number;
  height?: number;
  packageCode?: string;
  items?: Array<{
    sku: string;
    quantity: number;
    productName?: string;
    unitPrice?: number;
  }>;
};

function truncateReference(text: string, carrierCode: string): string {
  let maxLength = 35;
  switch (carrierCode.toLowerCase()) {
    case "ups":
      maxLength = 35;
      break;
    case "fedex":
      maxLength = 30;
      break;
    case "stamps_com":
    case "usps":
      maxLength = 50;
      break;
    default:
      maxLength = 30;
  }
  if (!text) return "";
  return text.length <= maxLength
    ? text
    : text.substring(0, maxLength - 3) + "...";
}

function validateCarrierService(carrier: string, service: string) {
  const validations = [
    {
      condition: carrier === "stamps_com" && service?.startsWith("ups_"),
      error: "Service code mismatch: UPS service selected with USPS carrier",
    },
    {
      condition: carrier === "ups" && service?.startsWith("usps_"),
      error: "Service code mismatch: USPS service selected with UPS carrier",
    },
    {
      condition:
        carrier === "fedex" &&
        (service?.startsWith("usps_") || service?.startsWith("ups_")),
      error:
        "Service code mismatch: Non-FedEx service selected with FedEx carrier",
    },
  ];
  for (const v of validations) if (v.condition) return v.error;
  return null;
}

function joinDedup(existing: string | null | undefined, next: string) {
  const parts = [existing, next]
    .filter(Boolean)
    .join(",")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(p);
    }
  }
  return deduped.join(", ");
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const {
      orderId,
      serviceCode,
      carrierCode,
      packages,
      shippingAddress,
      notes,
      items,
    } = await request.json();

    // Basic validation
    if (!orderId || !packages || packages.length === 0) {
      return NextResponse.json(
        { error: "Order ID and at least one package are required" },
        { status: 400 }
      );
    }
    if (!carrierCode || !serviceCode) {
      return NextResponse.json(
        { error: "Carrier code and service code are required" },
        { status: 400 }
      );
    }
    for (const [idx, pkg] of packages.entries()) {
      if (!pkg?.weight || pkg.weight <= 0) {
        return NextResponse.json(
          { error: `Package ${idx + 1} must have a valid weight` },
          { status: 400 }
        );
      }
    }

    console.log(`Creating shipping labels for order: ${orderId}`);
    console.log("Packages:", JSON.stringify(packages, null, 2));
    console.log("Carrier Code:", carrierCode);
    console.log("Service Code:", serviceCode);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            productVariant: { include: { product: true } },
          },
        },
      },
    });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Allow shipping if order is PACKED or already partially SHIPPED
    if (!["PACKED", "SHIPPED", "PARTIALLY_SHIPPED"].includes(order.status)) {
      return NextResponse.json(
        { error: "Order must be packed before shipping" },
        { status: 400 }
      );
    }

    // ===================================================================
    // ✅ NEW: Get or create shipping task for audit trail
    // ===================================================================
    const shippingTask = await getOrCreateShippingTask(
      orderId,
      userId,
      order.orderNumber
    );

    // ===================================================================
    // ✅ NEW: Log carrier selection with service level
    // ===================================================================
    await logCarrierSelected(shippingTask.id, userId, carrierCode, serviceCode);

    const warehouseAddress = {
      name: process.env.WAREHOUSE_NAME || "WMS Warehouse",
      company_name: process.env.WAREHOUSE_COMPANY || "Your Company",
      address_line1: process.env.WAREHOUSE_ADDRESS1 || "123 Warehouse St",
      city_locality: process.env.WAREHOUSE_CITY || "Los Angeles",
      state_province: process.env.WAREHOUSE_STATE || "CA",
      postal_code: process.env.WAREHOUSE_ZIP || "90210",
      country_code: "US",
      phone: process.env.WAREHOUSE_PHONE || "555-123-4567",
    };

    const addr = shippingAddress || order.shippingAddress;
    if (!addr) {
      return NextResponse.json(
        { error: "Shipping address is required" },
        { status: 400 }
      );
    }

    const customerAddress = {
      name: addr.name || order.customerName || "Customer",
      company_name: addr.company || undefined,
      address_line1: addr.address1 || addr.addressLine1,
      address_line2: addr.address2 || addr.addressLine2 || undefined,
      city_locality: addr.city,
      state_province: addr.province_code || addr.province || addr.stateProvince,
      postal_code: addr.zip || addr.postalCode,
      country_code: addr.country_code || addr.countryCode || "US",
      phone: addr.phone || "555-123-4567",
      address_residential_indicator: "yes" as const,
    };

    if (
      !customerAddress.address_line1 ||
      !customerAddress.city_locality ||
      !customerAddress.state_province ||
      !customerAddress.postal_code
    ) {
      return NextResponse.json(
        { error: "Incomplete shipping address - missing required fields" },
        { status: 400 }
      );
    }

    // Carrier/service compatibility
    const validationError = validateCarrierService(carrierCode, serviceCode);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // ===================================================================
    // ✅ NEW: Log package weight and dimensions for each package
    // ===================================================================
    for (const [idx, pkg] of packages.entries()) {
      // Log weight
      await logPackageWeighed(
        shippingTask.id,
        userId,
        pkg.weight,
        `package-${idx + 1}` // Temporary ID until we have real package IDs
      );

      // Log dimensions if provided
      if (pkg.length && pkg.width && pkg.height) {
        await logPackageDimensions(
          shippingTask.id,
          userId,
          {
            length: pkg.length,
            width: pkg.width,
            height: pkg.height,
            unit: "in",
          },
          `package-${idx + 1}`
        );
      }
    }

    // ✅ NEW: Determine if we need separate labels per package (USPS)
    const needsSeparateLabels =
      carrierCode === "stamps_com" && packages.length > 1;

    let allLabels: any[] = [];
    let allLabelPackages: any[] = [];
    let totalShipmentCost = 0;

    if (needsSeparateLabels) {
      console.log(
        `📦 Creating ${packages.length} separate USPS labels (parallelized)`
      );

      const warehouse = warehouseAddress;
      const customer = customerAddress;

      // Build all label creation promises
      const labelPromises = packages.map(
        async (pkg: PackageInput, i: number) => {
          const packageItems = pkg.items || [];

          const shipment = {
            carrier_code: carrierCode,
            service_code: serviceCode,
            ship_from: warehouse,
            ship_to: customer,
            weight: { value: pkg.weight, unit: "ounce" },
            dimensions: pkg.length
              ? {
                  length: pkg.length,
                  width: pkg.width,
                  height: pkg.height,
                  unit: "inch",
                }
              : undefined,
            packages: [
              {
                package_code: pkg.packageCode || "package",
                weight: { value: pkg.weight, unit: "ounce" },
                dimensions: pkg.length
                  ? {
                      length: pkg.length,
                      width: pkg.width,
                      height: pkg.height,
                      unit: "inch",
                    }
                  : undefined,
              },
            ],
            advanced_options: {
              custom_field1: order.orderNumber || orderId,
            },
          };

          const response = await fetch("https://api.shipengine.com/v1/labels", {
            method: "POST",
            headers: {
              "API-Key": process.env.SHIPENGINE_API_KEY!,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              shipment,
              label_format: "pdf",
              label_layout: "4x6",
              label_download_type: "url",
            }),
          });

          if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(
              `ShipEngine USPS label ${i + 1} failed: ${response.status} - ${
                err?.message || response.statusText
              }`
            );
          }

          const label = await response.json();
          console.log(
            `✅ USPS Label ${i + 1} created: ${label.tracking_number}`
          );

          return {
            label,
            trackingNumber: label.tracking_number,
            trackingUrl: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${label.tracking_number}`,
            cost: label.shipment_cost?.amount || 0,
            items: packageItems,
            pkg,
          };
        }
      );

      // Run all requests concurrently (safe and fast)
      const results = await Promise.allSettled(labelPromises);

      const successes = results
        .filter((r) => r.status === "fulfilled")
        .map((r) => (r as PromiseFulfilledResult<any>).value);

      const failures = results
        .filter((r) => r.status === "rejected")
        .map((r) => (r as PromiseRejectedResult).reason);

      if (failures.length) {
        console.error(`❌ ${failures.length} USPS label(s) failed:`, failures);
      }

      // Aggregate successful labels
      allLabels = successes.map((s) => s.label);
      totalShipmentCost = successes.reduce((sum, s) => sum + s.cost, 0);
      allLabelPackages = successes.map((s) => ({
        package_id: s.label.label_id,
        tracking_number: s.trackingNumber,
        label_download: s.label.label_download,
        weight: { value: s.pkg.weight || 1, unit: "pound" },
        dimensions: {
          length: s.pkg.length || 10,
          width: s.pkg.width || 8,
          height: s.pkg.height || 6,
          unit: "inch",
        },
        items: s.items,
      }));

      (request as any).uspsTrackingNumbers = successes.map(
        (s) => s.trackingNumber
      );
      (request as any).uspsTrackingUrls = successes.map((s) => s.trackingUrl);

      console.log(
        `✅ Created ${allLabelPackages.length} USPS labels in parallel`
      );
      console.log(`💰 Total cost: $${totalShipmentCost.toFixed(2)}`);
    } else {
      // ✅ UPS/FedEx: Create one multi-package shipment
      console.log(
        `📦 Creating single ${carrierCode.toUpperCase()} shipment with ${
          packages.length
        } package(s)`
      );

      const shipment = {
        carrier_code: carrierCode,
        service_code: serviceCode,
        ship_from: warehouseAddress,
        ship_to: customerAddress,
        packages: packages.map((pkg: any, idx: number) => {
          const baseReference1 = order.orderNumber;
          const baseReference2 =
            notes || `Package ${idx + 1} of ${packages.length}`;
          return {
            package_code: pkg.packageCode || "package",
            weight: {
              value: Math.max(pkg.weight || 1, 0.1),
              unit: "pound" as const,
            },
            dimensions: {
              unit: "inch" as const,
              length: Math.max(pkg.length || 10, 1),
              width: Math.max(pkg.width || 8, 1),
              height: Math.max(pkg.height || 6, 1),
            },
            label_messages: {
              reference1: truncateReference(baseReference1, carrierCode),
              reference2: truncateReference(baseReference2, carrierCode),
            },
          };
        }),
      };

      console.log("Final shipment payload:", JSON.stringify(shipment, null, 2));

      try {
        const response = await fetch("https://api.shipengine.com/v1/labels", {
          method: "POST",
          headers: {
            "API-Key": process.env.SHIPENGINE_API_KEY!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            shipment,
            label_format: "pdf",
            label_layout: "4x6",
            label_download_type: "url",
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(
            "ShipEngine API Error:",
            JSON.stringify(errorData, null, 2)
          );
          throw new Error(
            `ShipEngine API Error: ${response.status} - ${
              errorData?.message || response.statusText
            }`
          );
        }

        const label = await response.json();
        allLabels.push(label);
        totalShipmentCost = label.shipment_cost?.amount || 0;

        // Handle multi-package responses robustly
        allLabelPackages = label.packages || label.children || [];
        if (allLabelPackages.length === 0 && label.tracking_number) {
          // Single-package fallback
          allLabelPackages = [
            {
              package_id: label.label_id,
              tracking_number: label.tracking_number,
              label_download: label.label_download,
              weight: { value: packages[0]?.weight || 1, unit: "pound" },
              dimensions: {
                length: packages[0]?.length || 10,
                width: packages[0]?.width || 8,
                height: packages[0]?.height || 6,
                unit: "inch",
              },
            },
          ];
        }

        console.log(`✅ Created ${allLabelPackages.length} label(s)`);
        console.log(`💰 Total cost: $${totalShipmentCost}`);
      } catch (shipEngineError: unknown) {
        console.error("ShipEngine API Error:", shipEngineError);
        const errorMessage =
          shipEngineError instanceof Error
            ? shipEngineError.message
            : "ShipEngine API request failed";
        return NextResponse.json(
          { error: `Label creation failed: ${errorMessage}` },
          { status: 422 }
        );
      }
    }

    // Validate we got labels
    if (allLabelPackages.length === 0) {
      return NextResponse.json(
        { error: "No labels were created" },
        { status: 500 }
      );
    }

    console.log(
      "All tracking numbers:",
      allLabelPackages.map((p: any) => p.tracking_number).join(", ")
    );

    // ✅ Now use allLabelPackages in your transaction
    const labelPackages = allLabelPackages;

    // ===== DB TRANSACTION START (NO NETWORK CALLS INSIDE) =====
    const {
      updatedOrderAfterTxn,
      hasPendingBackOrders,
      reservationsReleasedDetails,
      backOrderFulfilledDetails,
      shippingPackages,
    } = await prisma.$transaction(async (tx) => {
      const numberOfPackages = labelPackages.length;
      const costPerPackage =
        numberOfPackages > 0
          ? totalShipmentCost / numberOfPackages
          : totalShipmentCost;

      console.log(`💰 Total shipment cost: $${totalShipmentCost}`);
      console.log(`📦 Number of packages: ${numberOfPackages}`);
      console.log(`💵 Cost per package: $${costPerPackage}`);

      // Create shipping packages WITH ITEMS
      const shippingPackages = await Promise.all(
        labelPackages.map((pkg: any, idx: number) => {
          const originalPackage = packages[Math.min(idx, packages.length - 1)];

          return tx.shippingPackage.create({
            data: {
              orderId: order.id,
              carrierCode,
              serviceCode,
              packageCode: originalPackage?.packageCode || "package",
              trackingNumber: pkg.tracking_number,
              labelUrl: pkg.label_download?.pdf || pkg.label_download?.href,
              cost: new Prisma.Decimal(costPerPackage),
              currency: "USD",
              weight: new Prisma.Decimal(
                pkg.weight?.value || originalPackage?.weight || 1
              ),
              dimensions: {
                length: pkg.dimensions?.length || originalPackage?.length || 10,
                width: pkg.dimensions?.width || originalPackage?.width || 8,
                height: pkg.dimensions?.height || originalPackage?.height || 6,
                unit: "inch",
              },
              items: {
                create: (originalPackage?.items || []).map((item: any) => ({
                  productName: item.productName,
                  sku: item.sku,
                  quantity: item.quantity,
                  unitPrice: new Prisma.Decimal(item.unitPrice),
                })),
              },
            },
          });
        })
      );

      // Find active back orders
      const activeBackOrders = await tx.backOrder.findMany({
        where: {
          orderId,
          status: { in: ["ALLOCATED", "PICKING", "PICKED", "PACKED"] },
        },
        include: {
          productVariant: { select: { sku: true } },
        },
      });
      const isBackOrderShipment = activeBackOrders.length > 0;

      console.log(
        `📦 Shipment type: ${
          isBackOrderShipment ? "BACK_ORDER" : "INITIAL_ORDER"
        }`
      );

      // ✅ NEW: Determine reservations to release based on package items
      let reservationsToRelease: Array<
        InventoryReservation & { quantityToRelease?: number }
      > = [];

      if (needsSeparateLabels) {
        // ✅ USPS multi-package: Release based on items in each package
        console.log(
          `📦 USPS multi-package: Calculating inventory to release from package items`
        );

        // Collect all items across all packages with their quantities
        const allPackageItems = new Map<string, number>(); // productVariantId -> total quantity

        for (const labelPkg of labelPackages) {
          const pkgItems = labelPkg.items || [];
          console.log(
            `  Package items:`,
            pkgItems.map((it: any) => `${it.sku}(${it.quantity})`).join(", ")
          );

          for (const item of pkgItems) {
            // Find the productVariantId from the order items
            const orderItem = order.items.find(
              (oi) => oi.productVariant.sku === item.sku
            );
            if (orderItem) {
              const current =
                allPackageItems.get(orderItem.productVariantId) || 0;
              allPackageItems.set(
                orderItem.productVariantId,
                current + item.quantity
              );
            }
          }
        }

        console.log(
          `📦 Total quantities to release by product:`,
          Array.from(allPackageItems.entries()).map(([id, qty]) => {
            const oi = order.items.find((i) => i.productVariantId === id);
            return `${oi?.productVariant.sku}: ${qty} units`;
          })
        );

        // Find reservations to release for these specific quantities
        for (const [productVariantId, neededQty] of allPackageItems.entries()) {
          const productReservations = await tx.inventoryReservation.findMany({
            where: {
              orderId,
              productVariantId,
              status: "ACTIVE",
            },
            orderBy: { createdAt: "desc" },
          });

          let remaining = neededQty;
          for (const reservation of productReservations) {
            if (remaining <= 0) break;
            const take = Math.min(reservation.quantity, remaining);
            reservationsToRelease.push({
              ...reservation,
              quantityToRelease: take,
            });
            remaining -= take;
          }

          if (remaining > 0) {
            throw new Error(
              `Not enough reservations. Need ${neededQty} units of product ${productVariantId} but only found ${
                neededQty - remaining
              }`
            );
          }
        }
      } else if (isBackOrderShipment) {
        // Back order shipment logic (existing)
        const backOrderProductIds = activeBackOrders.map(
          (bo) => bo.productVariantId
        );

        const allActiveReservations = await tx.inventoryReservation.findMany({
          where: {
            orderId,
            productVariantId: { in: backOrderProductIds },
            status: "ACTIVE",
          },
          orderBy: { createdAt: "desc" },
        });

        const neededQuantities = new Map<string, number>();
        for (const bo of activeBackOrders) {
          neededQuantities.set(bo.productVariantId, bo.quantityBackOrdered);
        }

        for (const [
          productVariantId,
          neededQty,
        ] of neededQuantities.entries()) {
          const productReservations = allActiveReservations.filter(
            (r) => r.productVariantId === productVariantId
          );

          let remaining = neededQty;
          for (const reservation of productReservations) {
            if (remaining <= 0) break;
            const take = Math.min(reservation.quantity, remaining);
            reservationsToRelease.push({
              ...reservation,
              quantityToRelease: take,
            });
            remaining -= take;
          }
          if (remaining > 0) {
            throw new Error(
              `Not enough reservations for back order. Need ${neededQty} units of product ${productVariantId} but insufficient reserved.`
            );
          }
        }
      } else {
        // ✅ FIXED: Regular shipment - release based on actual items being shipped
        console.log(
          `📦 Regular shipment: Calculating inventory to release from shipped items`
        );

        // Build map of quantities to release from items in packages
        const itemsToRelease = new Map<string, number>();

        // Aggregate items across all packages
        for (const pkg of packages) {
          const pkgItems = pkg.items || items || []; // Use package items or fallback to request items
          for (const item of pkgItems) {
            const orderItem = order.items.find(
              (oi) => oi.productVariant.sku === item.sku
            );
            if (orderItem) {
              const current =
                itemsToRelease.get(orderItem.productVariantId) || 0;
              itemsToRelease.set(
                orderItem.productVariantId,
                current + item.quantity
              );
            }
          }
        }

        console.log(
          `📦 Quantities to release:`,
          Array.from(itemsToRelease.entries()).map(([id, qty]) => {
            const oi = order.items.find((i) => i.productVariantId === id);
            return `${oi?.productVariant.sku}: ${qty} units`;
          })
        );

        // Find reservations to release for these specific quantities
        for (const [productVariantId, neededQty] of itemsToRelease.entries()) {
          const productReservations = await tx.inventoryReservation.findMany({
            where: {
              orderId,
              productVariantId,
              status: "ACTIVE",
            },
            orderBy: { createdAt: "desc" },
          });

          let remaining = neededQty;
          for (const reservation of productReservations) {
            if (remaining <= 0) break;
            const take = Math.min(reservation.quantity, remaining);
            reservationsToRelease.push({
              ...reservation,
              quantityToRelease: take,
            });
            remaining -= take;
          }

          if (remaining > 0) {
            console.warn(
              `⚠️ Not enough reservations for ${productVariantId}. Need ${neededQty} but only found ${
                neededQty - remaining
              }. This might be a short pick scenario.`
            );
          }
        }
      }

      const totalUnitsToRelease = reservationsToRelease.reduce(
        (sum, r) => sum + (r.quantityToRelease ?? r.quantity),
        0
      );
      console.log(`📦 Total units to release: ${totalUnitsToRelease}`);

      // Release inventory (single loop, handle partials)
      const releasedSummaries: ReleasedReservationSummary[] = [];
      for (const reservation of reservationsToRelease) {
        const qtyToRelease =
          reservation.quantityToRelease ?? reservation.quantity;

        // Update inventory
        await tx.inventory.update({
          where: {
            productVariantId_locationId: {
              productVariantId: reservation.productVariantId,
              locationId: reservation.locationId,
            },
          },
          data: {
            quantityReserved: { decrement: qtyToRelease },
            quantityOnHand: { decrement: qtyToRelease },
          },
        });

        // Inventory transaction
        const allTrackingNumbers = labelPackages
          .map((p: any) => p.tracking_number)
          .join(", ");

        await tx.inventoryTransaction.create({
          data: {
            productVariantId: reservation.productVariantId,
            locationId: reservation.locationId,
            transactionType: "SALE",
            quantityChange: -qtyToRelease,
            referenceId: orderId,
            referenceType: "SHIPMENT_LABEL_CREATED",
            userId: session.user.id,
            notes: `Released ${qtyToRelease} units for order ${
              order.orderNumber
            } - Tracking: ${allTrackingNumbers}${
              isBackOrderShipment ? " (Back Order)" : ""
            }`,
          },
        });

        // Reservation state
        if (qtyToRelease < reservation.quantity) {
          await tx.inventoryReservation.update({
            where: { id: reservation.id },
            data: { quantity: reservation.quantity - qtyToRelease },
          });
        } else {
          await tx.inventoryReservation.update({
            where: { id: reservation.id },
            data: { status: "FULFILLED" },
          });
        }

        // capture summary for Shopify quantities
        const existing = releasedSummaries.find(
          (s) => s.productVariantId === reservation.productVariantId
        );
        if (existing) {
          existing.quantityReleased += qtyToRelease;
        } else {
          releasedSummaries.push({
            productVariantId: reservation.productVariantId,
            quantityReleased: qtyToRelease,
          });
        }
      }

      // Mark back orders fulfilled if applicable
      const backOrderFulfilledDetails: BackOrderFulfilledSummary[] = [];
      if (isBackOrderShipment) {
        for (const bo of activeBackOrders) {
          await tx.backOrder.update({
            where: { id: bo.id },
            data: {
              status: "FULFILLED",
              fulfilledAt: new Date(),
              quantityFulfilled: bo.quantityBackOrdered,
            },
          });
          backOrderFulfilledDetails.push({
            productVariantId: bo.productVariantId,
            quantityBackOrdered: bo.quantityBackOrdered,
          });
        }
      }

      // Are there still pending back orders?
      const pendingBackOrders = await tx.backOrder.findMany({
        where: {
          orderId,
          status: { in: ["PENDING", "ALLOCATED", "PICKING", "PICKED"] },
        },
      });
      const hasPendingBackOrders = pendingBackOrders.length > 0;

      // ✅ Combine all tracking numbers
      const allTrackingNumbers = labelPackages
        .map((p: any) => p.tracking_number)
        .join(", ");

      // Update order fields
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          trackingNumber: order.trackingNumber
            ? `${order.trackingNumber}, ${allTrackingNumbers}`
            : allTrackingNumbers,
          trackingUrl:
            allLabels[0]?.tracking_url ||
            allLabels[0]?.label_download?.pdf ||
            labelPackages[0]?.label_download?.pdf,
          shippedAt: order.shippedAt || new Date(),
          shippingStatus: hasPendingBackOrders
            ? "PARTIALLY_SHIPPED"
            : "SHIPPED",
          shippingCost: order.shippingCost
            ? (parseFloat(order.shippingCost) + totalShipmentCost).toString()
            : totalShipmentCost.toString(),
          shippingCarrier: joinDedup(order.shippingCarrier, carrierCode),
          shippingService: joinDedup(order.shippingService, serviceCode),
          labelUrl: order.labelUrl
            ? `${order.labelUrl}, ${labelPackages
                .map(
                  (p: any) => p.label_download?.pdf || p.label_download?.href
                )
                .join(", ")}`
            : labelPackages
                .map(
                  (p: any) => p.label_download?.pdf || p.label_download?.href
                )
                .join(", "),
          notes: `${order.notes || ""} ${
            notes || `Shipped with ${labelPackages.length} package(s)`
          }`.trim(),
        },
      });

      const newStatus = hasPendingBackOrders ? "PARTIALLY_SHIPPED" : "SHIPPED";
      const statusNotes = hasPendingBackOrders
        ? `Partially shipped via ${carrierCode.toUpperCase()} - ${
            pendingBackOrders.length
          } item(s) still on back order - Tracking: ${allTrackingNumbers}`
        : `Shipped via ${carrierCode.toUpperCase()} - Tracking: ${allTrackingNumbers}`;

      await updateOrderStatus({
        orderId: order.id,
        newStatus,
        userId: session.user.id,
        notes: statusNotes,
        tx,
      });

      return {
        updatedOrderAfterTxn: updatedOrder,
        hasPendingBackOrders,
        reservationsReleasedDetails: releasedSummaries,
        backOrderFulfilledDetails,
        shippingPackages,
      };
    });
    // ===== DB TRANSACTION END =====

    try {
      console.log(
        `📦 Updating TaskItems for shipping task ${shippingTask.id}...`
      );

      // ✅ Get tracking numbers from labelPackages
      const trackingNumbers = labelPackages
        .map((p: any) => p.tracking_number)
        .filter(Boolean)
        .join(", ");

      // Get all TaskItems for this shipping task
      const taskItems = await prisma.taskItem.findMany({
        where: {
          taskId: shippingTask.id,
          orderId: order.id,
        },
      });

      console.log(`Found ${taskItems.length} task items to complete`);

      // Mark each TaskItem as completed
      for (const taskItem of taskItems) {
        await prisma.taskItem.update({
          where: { id: taskItem.id },
          data: {
            status: "COMPLETED",
            quantityCompleted: taskItem.quantityRequired, // ✅ Set the quantity
            completedBy: userId,
            completedAt: new Date(),
            notes: `Shipped via ${carrierCode.toUpperCase()} - Tracking: ${trackingNumbers}`,
          },
        });
      }

      console.log(`✅ Updated ${taskItems.length} task items to COMPLETED`);
    } catch (taskItemError) {
      console.error("⚠️ Failed to update task items:", taskItemError);
      // Don't fail the entire request if this fails
    }

    // ===================================================================
    // ✅ NEW: Log label generation events AFTER transaction succeeds
    // ===================================================================
    const allTrackingNumbers = labelPackages
      .map((p: any) => p.tracking_number)
      .filter(Boolean);

    if (needsSeparateLabels) {
      // Multiple labels (USPS)
      await logBatchLabelsGenerated(shippingTask.id, userId, {
        packageIds: shippingPackages.map((pkg) => pkg.id),
        trackingNumbers: allTrackingNumbers,
        carrier: carrierCode,
        serviceLevel: serviceCode,
        totalWeight: packages.reduce(
          (sum: number, pkg: PackageInput) => sum + pkg.weight,
          0
        ),
        totalCost: totalShipmentCost,
        packageCount: packages.length,
      });
    } else {
      // Single label or multi-package single label (UPS/FedEx)
      for (const [idx, pkg] of shippingPackages.entries()) {
        const packageData = packages[idx];
        await logLabelGenerated(shippingTask.id, userId, {
          packageId: pkg.id,
          trackingNumber: pkg.trackingNumber!,
          carrier: carrierCode,
          serviceLevel: serviceCode,
          weight: packageData.weight,
          shippingCost: pkg.cost?.toNumber() || 0,
          dimensions:
            packageData.length && packageData.width && packageData.height
              ? {
                  length: packageData.length,
                  width: packageData.width,
                  height: packageData.height,
                  unit: "in",
                }
              : undefined,
        });
      }
    }

    // ===================================================================
    // ✅ NEW: Mark shipping task as completed
    // ===================================================================
    await completeShippingTask(
      shippingTask.id,
      userId,
      shippingPackages.length
    );

    // ===================================================================
    // Auto-generate packing slips for all packages
    // ===================================================================
    try {
      console.log(
        `📄 Queueing packing slip generation for ${shippingPackages.length} package(s)...`
      );

      const packageIds = shippingPackages.map((pkg) => pkg.id);

      await queuePackingSlipGeneration(order.id, packageIds, order.orderNumber);

      console.log("✅ Packing slip generation queued");
    } catch (queueError) {
      console.error("⚠️ Failed to queue packing slips:", queueError);
    }

    // ===== SHOPIFY FULFILLMENT (OUTSIDE TRANSACTION) =====
    if (order.shopifyOrderId) {
      const isBackOrderShipment = (backOrderFulfilledDetails?.length ?? 0) > 0;

      // Map released quantities by productVariantId
      const releasedMap = new Map<string, number>();
      for (const r of reservationsReleasedDetails) {
        releasedMap.set(
          r.productVariantId,
          (releasedMap.get(r.productVariantId) || 0) + r.quantityReleased
        );
      }

      let itemsToFulfill: Array<{
        variantId?: string;
        sku: string;
        quantity: number;
      }> = [];

      if (isBackOrderShipment) {
        // Only back-ordered items with their fulfilled qty
        for (const bo of backOrderFulfilledDetails) {
          const orderItem = order.items.find(
            (it) => it.productVariantId === bo.productVariantId
          );
          if (!orderItem) continue;

          const qty =
            releasedMap.get(bo.productVariantId) || bo.quantityBackOrdered || 0;
          if (qty <= 0) continue;

          itemsToFulfill.push({
            variantId: orderItem.productVariant.shopifyVariantId
              ? `gid://shopify/ProductVariant/${orderItem.productVariant.shopifyVariantId}`
              : undefined,
            sku: orderItem.productVariant.sku,
            quantity: qty,
          });
        }
      } else {
        // ✅ FIXED: Initial/regular shipment — use the items from the request (which have correct picked quantities)
        // The 'items' parameter already contains the correct quantities from the packing API
        if (items && items.length > 0) {
          for (const item of items) {
            const orderItem = order.items.find(
              (it) => it.productVariant.sku === item.sku
            );
            if (!orderItem) continue;

            itemsToFulfill.push({
              variantId: orderItem.productVariant.shopifyVariantId
                ? `gid://shopify/ProductVariant/${orderItem.productVariant.shopifyVariantId}`
                : undefined,
              sku: item.sku,
              quantity: item.quantity, // ✅ Use quantity from request (30), not from reservations (40)
            });
          }
        } else {
          // Fallback to releasedMap if items not provided (backward compatibility)
          for (const [productVariantId, qty] of releasedMap) {
            if (qty <= 0) continue;
            const orderItem = order.items.find(
              (it) => it.productVariantId === productVariantId
            );
            if (!orderItem) continue;

            itemsToFulfill.push({
              variantId: orderItem.productVariant.shopifyVariantId
                ? `gid://shopify/ProductVariant/${orderItem.productVariant.shopifyVariantId}`
                : undefined,
              sku: orderItem.productVariant.sku,
              quantity: qty,
            });
          }
        }
      }

      try {
        if (itemsToFulfill.length > 0) {
          console.log(
            `📦 Queueing Shopify fulfillment for order ${
              order.shopifyOrderId
            } with ${itemsToFulfill.reduce(
              (s, i) => s + i.quantity,
              0
            )} total units`
          );

          // ✅ Collect ALL tracking numbers from all packages
          const uspsTrackingNumbers =
            (request as any).uspsTrackingNumbers || [];
          const uspsTrackingUrls = (request as any).uspsTrackingUrls || [];

          const allTrackingNumbers: string[] =
            uspsTrackingNumbers.length > 0
              ? uspsTrackingNumbers
              : shippingPackages.map((pkg) => pkg.trackingNumber as string);

          const allTrackingUrls =
            uspsTrackingUrls.length > 0
              ? uspsTrackingUrls
              : allTrackingNumbers.map(
                  (n) =>
                    `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`
                );

          // ✅ Queue Shopify fulfillment (non-blocking)
          await queueShopifyFulfillment({
            orderId: order.id,
            shopifyOrderId: order.shopifyOrderId,
            trackingNumbers: allTrackingNumbers,
            trackingUrls: allTrackingUrls,
            carrier: carrierCode,
            lineItems: itemsToFulfill,
            isBackOrder: isBackOrderShipment,
          });

          console.log("✅ Shopify fulfillment queued");
          console.log(`📋 Tracking numbers: ${allTrackingNumbers.join(", ")}`);
        } else {
          console.warn(
            "⚠️ No Shopify line items to fulfill for this shipment."
          );
          console.warn(
            "backOrderFulfilledDetails:",
            JSON.stringify(backOrderFulfilledDetails, null, 2)
          );
          console.warn(
            "reservationsReleasedDetails:",
            JSON.stringify(reservationsReleasedDetails, null, 2)
          );
        }
      } catch (queueError) {
        console.error("⚠️ Failed to queue Shopify fulfillment:", queueError);

        // ✅ Fallback: Record sync task for manual retry
        await prisma.shopifySync.create({
          data: {
            orderId: order.id,
            syncType: "FULFILLMENT",
            status: "PENDING",
            attempts: 0,
            data: {
              trackingNumbers: shippingPackages.map(
                (pkg) => pkg.trackingNumber
              ),
              carrier: carrierCode,
              isBackOrder: isBackOrderShipment,
              itemsToFulfill,
            },
            error:
              queueError instanceof Error
                ? queueError.message
                : "Unknown error",
          },
        });
        console.log("📝 Shopify sync task created for manual retry");
      }
    }

    // ===================================================================
    // ✅ Queue customer notification
    // ===================================================================
    try {
      const allTrackingNumbers = shippingPackages.map(
        (pkg) => pkg.trackingNumber as string
      );

      await queueShipmentNotification({
        orderId: order.id,
        orderNumber: order.orderNumber,
        userId: session.user.id,
        customerEmail: order.customerEmail || "",
        type: "shipped",
        trackingNumbers: allTrackingNumbers,
      });

      console.log("✅ Notification queued");
    } catch (notifError) {
      console.error("⚠️ Failed to queue notification:", notifError);
      // Non-critical
    }

    // Final response
    return NextResponse.json({
      success: true,
      label: {
        trackingNumber: labelPackages[0]?.tracking_number,
        cost: totalShipmentCost,
        labelUrl:
          labelPackages[0]?.label_download?.pdf ||
          labelPackages[0]?.label_download?.href,
        trackingUrl: allLabels[0]?.tracking_url,
      },
      labels: labelPackages.map((pkg: any) => ({
        trackingNumber: pkg.tracking_number,
        cost: totalShipmentCost / labelPackages.length,
        labelUrl: pkg.label_download?.pdf || pkg.label_download?.href,
      })),
      orderId: order.id,
      orderNumber: order.orderNumber,
      isTestLabel: process.env.SHIPENGINE_SANDBOX === "true",
      // ✅ NEW: Include shipping task info in response
      shippingTaskId: shippingTask.id,
      shippingTaskNumber: shippingTask.taskNumber,
    });
  } catch (error) {
    console.error("Error creating ShipEngine label:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json(
        { error: "Database error occurred while creating shipping label" },
        { status: 500 }
      );
    }

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to create shipping label";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
