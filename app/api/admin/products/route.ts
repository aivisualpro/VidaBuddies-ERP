import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaProduct from "@/lib/models/VidaProduct";
import crypto from "crypto";

function generateVbId(): string {
  return `VB-${crypto.randomBytes(3).toString("hex").toUpperCase().slice(0, 5)}`;
}

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const items = await VidaProduct.find({});
    return NextResponse.json(items);
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();

    // Auto-generate vbId if not provided
    if (!body.vbId) {
      let vbId = generateVbId();
      // Ensure uniqueness
      while (await VidaProduct.exists({ vbId })) {
        vbId = generateVbId();
      }
      body.vbId = vbId;
    }

    const newItem = await VidaProduct.create(body);
    return NextResponse.json(newItem);
  } catch (error: any) {
    console.error("Error creating product:", error);

    // Duplicate key error (e.g., vbId already exists)
    if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || "field";
      return NextResponse.json(
        { error: `A product with this ${field} already exists` },
        { status: 400 }
      );
    }

    // Mongoose validation error
    if (error?.name === "ValidationError") {
      const messages = Object.values(error.errors || {}).map((e: any) => e.message);
      return NextResponse.json(
        { error: messages.join(", ") || "Validation failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
