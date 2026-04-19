import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaQuote from "@/lib/models/VidaQuote";
import { getSession } from "@/lib/auth";

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    await connectToDatabase();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const updated = await VidaQuote.findByIdAndUpdate(params.id, body, { new: true });
    
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    await connectToDatabase();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await VidaQuote.findByIdAndDelete(params.id);
    return NextResponse.json({ success: true });
  } catch(error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
