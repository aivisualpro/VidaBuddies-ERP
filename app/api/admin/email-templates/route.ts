import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import EmailTemplate from "@/lib/models/EmailTemplate";

/**
 * GET — List all templates
 */
export async function GET() {
  try {
    await connectToDatabase();
    const templates = await EmailTemplate.find().sort({ updatedAt: -1 }).lean();
    return NextResponse.json({ templates });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST — Create or update a template
 * Body: { name, subject?, body }
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const { name, subject, body } = await request.json();

    if (!name) {
      return NextResponse.json({ error: "Template name is required" }, { status: 400 });
    }

    const template = await EmailTemplate.findOneAndUpdate(
      { name },
      { subject, body, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    return NextResponse.json({ template });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE — Delete a template
 * Body: { name }
 */
export async function DELETE(request: NextRequest) {
  try {
    await connectToDatabase();
    const { name } = await request.json();
    await EmailTemplate.deleteOne({ name });
    return NextResponse.json({ deleted: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
