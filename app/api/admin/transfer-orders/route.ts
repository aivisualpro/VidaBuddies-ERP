import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaTransferOrder from "@/lib/models/VidaTransferOrder";
import VidaProduct from "@/lib/models/VidaProduct";
import VidaWarehouse from "@/lib/models/VidaWarehouse";
import VidaSupplier from "@/lib/models/VidaSupplier";
import VBshipping from "@/lib/models/VBshipping";
import VidaUser from "@/lib/models/VidaUser";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Ensure populated models are registered
const _models = { VidaProduct, VidaWarehouse, VidaSupplier, VBshipping, VidaUser };

/**
 * GET /api/admin/transfer-orders
 * Optional: ?shipmentId=xxx   — filter by shipment
 * Without params returns ALL transfer orders (for listing page)
 */
export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const shipmentId = req.nextUrl.searchParams.get("shipmentId");

    const filter: any = {};
    if (shipmentId) filter.vbShipmentNumber = shipmentId;

    const orders = await VidaTransferOrder.find(filter)
      .populate("vbShipmentNumber", "VBShipmentNumber svbid")
      .populate("warehouse", "name")
      .populate("product", "name vbId")
      .populate("supplier", "name vbId")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json(orders);
  } catch (error: any) {
    console.error("Transfer Orders GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/transfer-orders
 * Body: { vbShipmentNumber, warehouse, supplier, transferDate, products: [{ product, serialNumber, qty, batchNumber, uom, weight }] }
 * Creates one document per product in vidaTransferOrders.
 * Warehouse can be an ObjectId string or a warehouse name string — we resolve name→ObjectId automatically.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    await connectToDatabase();

    const { vbShipmentNumber, warehouse, supplier, transferDate, products } = body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: "products array required" }, { status: 400 });
    }

    // Resolve warehouse: if it's a valid ObjectId use it directly, otherwise look up by name
    let warehouseId = null;
    if (warehouse) {
      if (/^[a-fA-F0-9]{24}$/.test(warehouse)) {
        warehouseId = warehouse;
      } else {
        // Warehouse was passed as a name string — resolve to ObjectId
        const wDoc = await VidaWarehouse.findOne({ name: warehouse }).select("_id").lean();
        warehouseId = wDoc?._id || null;
      }
    }

    const createdBy = session.id || null;

    // Create one document per product line
    const docs = products.map((p: any) => ({
      vbShipmentNumber,
      warehouse: warehouseId,
      product: p.product,
      supplier: supplier || null,
      serialNumber: p.serialNumber || "",
      qty: p.qty || 0,
      batchNumber: p.batchNumber || "",
      uom: p.uom || "",
      weight: p.weight || 0,
      receivedDate: transferDate ? new Date(transferDate) : new Date(),
      createdBy,
    }));

    const created = await VidaTransferOrder.insertMany(docs);

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    console.error("Transfer Orders POST Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
