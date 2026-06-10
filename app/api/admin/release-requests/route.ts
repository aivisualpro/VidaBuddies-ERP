import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaReleaseRequest from "@/lib/models/VidaReleaseRequest";
import VidaProduct from "@/lib/models/VidaProduct";
import VidaWarehouse from "@/lib/models/VidaWarehouse";
import VidaCustomer from "@/lib/models/VidaCustomer";
import VidaUser from "@/lib/models/VidaUser";
import VBcustomerPO from "@/lib/models/VBcustomerPO";
import VidaTransferOrder from "@/lib/models/VidaTransferOrder";
import VBshipping from "@/lib/models/VBshipping";
import { getSession } from "@/lib/auth";
import { broadcastMutation } from "@/lib/pusher/broadcast";

// Force dynamic to ensure fresh data
export const dynamic = "force-dynamic";

// Ensure all populated models are registered (prevents tree-shaking in production)
const _models = { VidaProduct, VidaWarehouse, VidaCustomer, VidaUser, VBcustomerPO, VidaTransferOrder, VBshipping };

export async function GET() {
  try {
    await connectToDatabase();
    const requests = await VidaReleaseRequest.find()
      .populate("warehouse", "name")
      .populate("customer", "name location")
      .populate("requestedBy", "name email")
      // poNo is populated separately below to handle non-ObjectId values gracefully
      .populate("transferOrder", "VBShipmentNumber svbid")
      .populate({
         path: 'releaseOrderProducts.product',
         model: _models.VidaProduct.modelName,
         select: 'name vbId'
      })
      .sort({ createdAt: -1 })
      .lean();

    // Manually populate poNo – some documents may have a plain string (e.g.
    // "ZK052926-885") instead of an ObjectId, which would crash a normal
    // .populate() call.  Collect the valid ObjectIds, fetch them in one query,
    // and stitch the results back.
    const { Types } = await import("mongoose");
    const poIdMap = new Map<string, any>();
    const validPoIds: string[] = [];

    for (const r of requests as any[]) {
      if (r.poNo && Types.ObjectId.isValid(r.poNo) && String(new Types.ObjectId(r.poNo)) === String(r.poNo)) {
        validPoIds.push(String(r.poNo));
      }
    }

    if (validPoIds.length > 0) {
      const pos = await _models.VBcustomerPO
        .find({ _id: { $in: validPoIds } })
        .select("customerPONo VBSerialNumber customer")
        .lean();
      for (const po of pos) {
        poIdMap.set(String(po._id), po);
      }
    }

    for (const r of requests as any[]) {
      const key = r.poNo ? String(r.poNo) : null;
      if (key && poIdMap.has(key)) {
        r.poNo = poIdMap.get(key);
      }
      // else: leave poNo as the raw value (string or null)
    }

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
      .populate("poNo", "customerPONo VBSerialNumber customer")
      .populate("transferOrder", "VBShipmentNumber svbid")
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
