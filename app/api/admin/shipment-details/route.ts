import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VBshipping from "@/lib/models/VBshipping";
import VBcustomerPO from "@/lib/models/VBcustomerPO";
import VidaCustomer from "@/lib/models/VidaCustomer";
import VidaWarehouse from "@/lib/models/VidaWarehouse";

export const dynamic = "force-dynamic";

// Ensure models are registered
const _models = { VBshipping, VBcustomerPO, VidaCustomer, VidaWarehouse };

/**
 * GET /api/admin/shipment-details?shipmentId=xxx
 *
 * Given a VBshipping ObjectId, returns the associated:
 *  - warehouse (from CPO)
 *  - customer (from CPO)
 *  - customerLocation name (resolved from VidaCustomer.location[])
 */
export async function GET(req: NextRequest) {
  try {
    const shipmentId = req.nextUrl.searchParams.get("shipmentId");
    if (!shipmentId) {
      return NextResponse.json({ error: "shipmentId required" }, { status: 400 });
    }

    await connectToDatabase();

    // 1. Fetch the VBshipping document
    const shipping = await VBshipping.findById(shipmentId)
      .select("VBSerialNumber VBShipmentNumber")
      .lean();

    if (!shipping) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    // 2. Fetch the VBcustomerPO via VBSerialNumber (which is CPO _id ref)
    let customer: string | null = null;
    let customerLocation: string | null = null;
    let warehouse: string | null = null;
    let contactName: string = "";

    if (shipping.VBSerialNumber) {
      const cpo = await VBcustomerPO.findById(shipping.VBSerialNumber)
        .select("customer customerLocation warehouse")
        .lean() as any;

      if (cpo) {
        customer = cpo.customer ? String(cpo.customer) : null;
        customerLocation = cpo.customerLocation ? String(cpo.customerLocation) : null;
        warehouse = cpo.warehouse ? String(cpo.warehouse) : null;

        // 3. Resolve contact location name from VidaCustomer.location[]
        if (customer && customerLocation) {
          const cust = await VidaCustomer.findById(customer)
            .select("location")
            .lean() as any;

          if (cust?.location && Array.isArray(cust.location)) {
            const loc = cust.location.find(
              (l: any) => String(l._id) === customerLocation
            );
            if (loc) {
              contactName = loc.locationName || loc.fullAddress || "";
            }
          }
        }
      }
    }

    return NextResponse.json({
      customer,
      customerLocation,
      warehouse,
      contactName,
    });
  } catch (error: any) {
    console.error("Shipment Details GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
