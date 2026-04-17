import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import VidaSupplierSpec from "@/lib/models/VidaSupplierSpec";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string, specId: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { specId } = await params;
    const body = await req.json();
    const { name, products } = body;

    await connectToDatabase();
    
    const updatedSpec = await VidaSupplierSpec.findByIdAndUpdate(
      specId,
      { name, products },
      { new: true }
    ).populate('products', 'name vbId');

    if (!updatedSpec) {
      return NextResponse.json({ error: "Spec not found" }, { status: 404 });
    }

    return NextResponse.json(updatedSpec);
  } catch (error) {
    console.error("Specs PUT error:", error);
    return NextResponse.json({ error: "Failed to update spec" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string, specId: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { specId } = await params;

    await connectToDatabase();
    
    // We could additionally optionally delete from google drive if needed, 
    // but the request was simple delete for now.
    const deletedSpec = await VidaSupplierSpec.findByIdAndDelete(specId);

    if (!deletedSpec) {
      return NextResponse.json({ error: "Spec not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Specs DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete spec" }, { status: 500 });
  }
}
