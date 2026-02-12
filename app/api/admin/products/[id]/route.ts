import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaProduct from "@/lib/models/VidaProduct";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectToDatabase();
    
    const product = await VidaProduct.findById(id).populate('relatedProducts', 'name primaryImage salePrice');
    
    if (!product) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    
    return NextResponse.json(product);
  } catch (error) {
    console.error("Error fetching product:", error);
    return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectToDatabase();
    const body = await req.json();
    const updatedItem = await VidaProduct.findByIdAndUpdate(id, body, { new: true, runValidators: true });
    if (!updatedItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    return NextResponse.json(updatedItem);
  } catch (error: any) {
    console.error("Error updating product:", error);

    if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || "field";
      return NextResponse.json(
        { error: `A product with this ${field} already exists` },
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

    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectToDatabase();
    const deletedItem = await VidaProduct.findByIdAndDelete(id);
    if (!deletedItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting product:", error);
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}
