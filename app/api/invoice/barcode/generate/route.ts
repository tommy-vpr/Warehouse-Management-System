// app/api/barcode/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import bwipjs from "bwip-js";

export async function GET(req: NextRequest) {
  try {
    const text = req.nextUrl.searchParams.get("text");
    const type = req.nextUrl.searchParams.get("type") || "code128";
    const scale = parseInt(req.nextUrl.searchParams.get("scale") || "3");
    const height = parseInt(req.nextUrl.searchParams.get("height") || "10");
    const includetext = req.nextUrl.searchParams.get("includetext") !== "false";

    if (!text) {
      return NextResponse.json({ error: "Text required" }, { status: 400 });
    }

    console.log("Generating barcode for:", text);

    const png = await new Promise<Buffer>((resolve, reject) => {
      bwipjs.toBuffer(
        {
          bcid: type,
          text: text,
          scale: scale,
          height: height,
          includetext: includetext,
          textxalign: "center",
        },
        (err, png) => {
          if (err) {
            console.error("bwip-js error:", err);
            reject(err);
          } else {
            resolve(png);
          }
        }
      );
    });

    console.log("✅ Barcode generated successfully");

    // Convert Buffer to Uint8Array for Next.js
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("❌ Barcode generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate barcode" },
      { status: 500 }
    );
  }
}
