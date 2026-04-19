import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaSupplier from "@/lib/models/VidaSupplier";
import { encryptPassword, decryptPassword } from "@/lib/encryption";
import mongoose from "mongoose";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid supplier ID format" }, { status: 400 });
    }

    await connectToDatabase();
    const item = await VidaSupplier.findById(id).lean();
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    
    if (item.portalPassword) {
      item.portalPassword = decryptPassword(item.portalPassword as string);
    }
    
    return NextResponse.json(item);
  } catch (error) {
    console.error("Error fetching supplier:", error);
    return NextResponse.json({ error: "Failed to fetch supplier" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid supplier ID format" }, { status: 400 });
    }

    await connectToDatabase();
    const body = await req.json();
    
    if (body.portalPassword) {
      body.portalPassword = encryptPassword(body.portalPassword);
    }
    
    const updatedItem = await VidaSupplier.findByIdAndUpdate(id, body, { new: true }).lean();
    if (!updatedItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    
    if (updatedItem.portalPassword) {
      updatedItem.portalPassword = decryptPassword(updatedItem.portalPassword as string);
    }
    
    return NextResponse.json(updatedItem);
  } catch (error) {
    console.error("Error updating supplier:", error);
    return NextResponse.json({ error: "Failed to update supplier" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid supplier ID format" }, { status: 400 });
    }

    await connectToDatabase();
    const deletedItem = await VidaSupplier.findByIdAndDelete(id);
    if (!deletedItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting supplier:", error);
    return NextResponse.json({ error: "Failed to delete supplier" }, { status: 500 });
  }
}
