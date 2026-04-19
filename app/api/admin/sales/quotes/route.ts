import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaQuote from "@/lib/models/VidaQuote";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    await connectToDatabase();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const quotes = await VidaQuote.find({}).sort({ createdAt: -1 }).lean();
    return NextResponse.json(quotes);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    // Auto-generate a quote number if not provided
    if (!body.quoteNumber) {
        const count = await VidaQuote.countDocuments();
        body.quoteNumber = `QT-2024-${String(count + 1000).padStart(4, '0')}`;
    }

    const newQuote = await VidaQuote.create(body);
    return NextResponse.json(newQuote);
  } catch (error: any) {
    console.error("Failed to create quote:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
