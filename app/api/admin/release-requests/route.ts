import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaReleaseRequest from "@/lib/models/VidaReleaseRequest";
import VidaProduct from "@/lib/models/VidaProduct";
import VidaWarehouse from "@/lib/models/VidaWarehouse";
import { getSession } from "@/lib/auth";

// Force dynamic to ensure fresh data
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectToDatabase();
    const requests = await VidaReleaseRequest.find()
      .populate("warehouse", "name")
      .populate("customer", "name location")
      .populate("requestedBy", "name email")
      .populate({
         path: 'releaseOrderProducts.product',
         model: 'VidaProduct',
         select: 'name vbId'
      })
      .sort({ createdAt: -1 })
      .lean();
    return NextResponse.json(requests);
  } catch (error: any) {
    console.error("Release Requests GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    await connectToDatabase();
    
    // Auto-populate createdBy from session
    body.createdBy = session.name || session.email;

    const newRequest = await VidaReleaseRequest.create(body);
    const populated = await VidaReleaseRequest.findById(newRequest._id)
      .populate("warehouse")
      .populate("customer")
      .populate("requestedBy")
      .populate({
         path: 'releaseOrderProducts.product',
         model: 'VidaProduct'
      });
    
    return NextResponse.json(populated, { status: 201 });
  } catch (error: any) {
    console.error("Release Request Create Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
