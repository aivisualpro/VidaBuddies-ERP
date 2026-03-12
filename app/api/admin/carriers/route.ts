import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaCarrier from "@/lib/models/VidaCarrier";

// Force dynamic to ensure fresh data
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectToDatabase();
    const carriers = await VidaCarrier.find({}).sort({ name: 1 }).lean();
    return NextResponse.json(carriers);
  } catch (error: any) {
    console.error("Error fetching carriers:", error);
    return NextResponse.json({ error: "Failed to fetch carriers" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();
    
    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: "Carrier name is required" }, { status: 400 });
    }

    // Check for duplicate (case-insensitive)
    const existing = await VidaCarrier.findOne({ 
      name: { $regex: new RegExp(`^${body.name.trim()}$`, 'i') } 
    });
    if (existing) {
      return NextResponse.json(existing); // Return existing instead of error
    }

    const newCarrier = await VidaCarrier.create({ name: body.name.trim() });
    return NextResponse.json(newCarrier, { status: 201 });
  } catch (error: any) {
    console.error("Error creating carrier:", error);
    return NextResponse.json({ error: error.message || "Failed to create carrier" }, { status: 500 });
  }
}
