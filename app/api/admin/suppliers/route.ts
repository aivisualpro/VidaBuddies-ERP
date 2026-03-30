import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaSupplier from "@/lib/models/VidaSupplier";
import crypto from "crypto";
import { encryptPassword, decryptPassword } from "@/lib/encryption";

function generateVbId(): string {
  return `VB-${crypto.randomBytes(3).toString("hex").toUpperCase().slice(0, 5)}`;
}

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const items = await VidaSupplier.find({}).lean();
    const itemsDecrypted = items.map(item => ({
      ...item,
      portalPassword: item.portalPassword ? decryptPassword(item.portalPassword as string) : null
    }));
    return NextResponse.json(itemsDecrypted);
  } catch (error) {
    console.error("Error fetching suppliers:", error);
    return NextResponse.json({ error: "Failed to fetch suppliers" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();

    if (body.portalPassword) {
      body.portalPassword = encryptPassword(body.portalPassword);
    }

    // Auto-generate vbId for the supplier
    if (!body.vbId) {
      let vbId = generateVbId();
      while (await VidaSupplier.exists({ vbId })) {
        vbId = generateVbId();
      }
      body.vbId = vbId;
    }

    // Auto-generate vbId for each location that doesn't have one
    if (Array.isArray(body.location)) {
      body.location = body.location.map((loc: any) => {
        if (!loc.vbId) {
          loc.vbId = generateVbId();
        }
        return loc;
      });
    }

    const newItem = await VidaSupplier.create(body);
    return NextResponse.json(newItem);
  } catch (error: any) {
    console.error("Error creating supplier:", error);

    if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || "field";
      return NextResponse.json(
        { error: `A supplier with this ${field} already exists` },
        { status: 400 }
      );
    }

    if (error?.name === "ValidationError") {
      const messages = Object.values(error.errors || {}).map((e: any) => e.message);
      return NextResponse.json(
        { error: messages.join(", ") || "Validation failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Failed to create supplier" }, { status: 500 });
  }
}
