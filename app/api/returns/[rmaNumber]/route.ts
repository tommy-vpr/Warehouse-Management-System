import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";

// 🧮 Convert Prisma.Decimal values to JS numbers
function decimalToNumber<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_, value) =>
      value instanceof Prisma.Decimal ? Number(value) : value
    )
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ rmaNumber: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { rmaNumber } = await params;

    console.log("📦 Fetching return detail:", rmaNumber);

    const returnOrder = await prisma.returnOrder.findUnique({
      where: { rmaNumber },
      include: {
        order: {
          select: {
            orderNumber: true,
            totalAmount: true,
          },
        },
        items: {
          include: {
            productVariant: {
              include: {
                product: true,
              },
            },
            inspections: {
              include: {
                inspector: {
                  select: {
                    name: true,
                    email: true,
                  },
                },
                location: {
                  select: {
                    name: true,
                    aisle: true,
                    shelf: true,
                    bin: true,
                  },
                },
              },
              orderBy: { inspectedAt: "desc" },
            },
          },
        },
        receivedByUser: { select: { name: true, email: true } },
        inspectedByUser: { select: { name: true, email: true } },
        approvedByUser: { select: { name: true, email: true } },
        events: {
          include: {
            user: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!returnOrder) {
      return NextResponse.json({ error: "Return not found" }, { status: 404 });
    }

    console.log("✅ Return found:", returnOrder.rmaNumber);

    // 👇 Fix: Convert decimals to numbers before sending
    return NextResponse.json(decimalToNumber(returnOrder));
  } catch (error) {
    console.error("❌ Error fetching return detail:", error);
    return NextResponse.json(
      { error: "Failed to fetch return detail" },
      { status: 500 }
    );
  }
}

// import { NextRequest, NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";
// import { returnOrderIncludes } from "@/types/returns";

// export async function GET(
//   request: NextRequest,
//   { params }: { params: { rmaNumber: string } }
// ) {
//   try {
//     const returnOrder = await prisma.returnOrder.findUnique({
//       where: { rmaNumber: params.rmaNumber },
//       include: returnOrderIncludes.detailed,
//     });

//     if (!returnOrder) {
//       return NextResponse.json({ error: "Return not found" }, { status: 404 });
//     }

//     return NextResponse.json(returnOrder);
//   } catch (error) {
//     console.error("Error fetching return:", error);
//     return NextResponse.json(
//       { error: "Failed to fetch return" },
//       { status: 500 }
//     );
//   }
// }
