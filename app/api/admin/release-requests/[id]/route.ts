import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaReleaseRequest from "@/lib/models/VidaReleaseRequest";
import VidaProduct from "@/lib/models/VidaProduct";
import VidaWarehouse from "@/lib/models/VidaWarehouse";
import VidaCustomer from "@/lib/models/VidaCustomer";
import VidaUser from "@/lib/models/VidaUser";

// Ensure all populated models are registered (prevents tree-shaking in production)
const _models = { VidaProduct, VidaWarehouse, VidaCustomer, VidaUser };

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const requestItem = await VidaReleaseRequest.findById(id)
      .populate("warehouse", "name")
      .populate("customer", "name location")
      .populate("requestedBy", "name email")
      .populate({
        path: 'releaseOrderProducts.product',
        model: _models.VidaProduct.modelName,
        select: 'name vbId'
      })
      .lean();
      
    if (!requestItem) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(requestItem);
  } catch (error: any) {
    console.error("Release Request GET [id] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    await connectToDatabase();
    const { id } = await params;
    
    const updated = await VidaReleaseRequest.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    })
      .populate("warehouse", "name")
      .populate("customer", "name location")
      .populate("requestedBy", "name email")
      .populate({
        path: 'releaseOrderProducts.product',
        model: _models.VidaProduct.modelName,
        select: 'name vbId'
      })
      .lean();

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("Release Request PUT Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const deleted = await VidaReleaseRequest.findByIdAndDelete(id);
    
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Deleted successfully" });
  } catch (error: any) {
    console.error("Release Request DELETE Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
