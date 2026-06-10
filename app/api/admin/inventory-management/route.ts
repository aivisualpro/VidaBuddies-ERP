import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaTransferOrder from "@/lib/models/VidaTransferOrder";
import VidaReleaseRequest from "@/lib/models/VidaReleaseRequest";
import VidaProduct from "@/lib/models/VidaProduct";
import VidaWarehouse from "@/lib/models/VidaWarehouse";
import VidaSupplier from "@/lib/models/VidaSupplier";
import VBshipping from "@/lib/models/VBshipping";

export const dynamic = "force-dynamic";

// Ensure populated models are registered
const _models = { VidaProduct, VidaWarehouse, VidaSupplier, VBshipping };

/**
 * GET /api/admin/inventory-management
 *
 * Computes available qty per transfer-order line:
 *   availableQty = transferOrder.qty − SUM(releaseRequest.releaseOrderProducts.qty)
 *
 * Release request quantities only count when the release request has a
 * `transferOrder` (VBshipping ObjectId) that matches the transfer order's
 * `vbShipmentNumber`, AND the product matches.
 */
export async function GET() {
  try {
    await connectToDatabase();

    // 1. Fetch all transfer order rows
    const transferOrders = await VidaTransferOrder.find()
      .populate("vbShipmentNumber", "VBShipmentNumber svbid")
      .populate("warehouse", "name")
      .populate("product", "name vbId")
      .populate("supplier", "name vbId")
      .sort({ receivedDate: -1, createdAt: -1 })
      .lean();

    // 2. Fetch all release requests that have a transferOrder linked
    const releaseRequests = await VidaReleaseRequest.find({
      transferOrder: { $ne: null },
    })
      .select("transferOrder releaseOrderProducts")
      .lean();

    // 3. Build a map: (shipmentId + productId) → total released qty
    //    transferOrder in release request = VBshipping ObjectId
    //    vbShipmentNumber in transfer order = VBshipping ObjectId
    const releasedMap = new Map<string, number>();

    for (const rr of releaseRequests as any[]) {
      const shipId = String(rr.transferOrder);
      for (const p of rr.releaseOrderProducts || []) {
        const key = `${shipId}::${String(p.product)}`;
        releasedMap.set(key, (releasedMap.get(key) || 0) + (p.qty || 0));
      }
    }

    // 4. Compute available qty for each transfer order row
    const rows = (transferOrders as any[]).map((to) => {
      const shipId = to.vbShipmentNumber?._id
        ? String(to.vbShipmentNumber._id)
        : String(to.vbShipmentNumber || "");
      const productId = to.product?._id
        ? String(to.product._id)
        : String(to.product || "");
      const key = `${shipId}::${productId}`;
      const released = releasedMap.get(key) || 0;
      const availableQty = (to.qty || 0) - released;

      return {
        _id: to._id,
        warehouse: to.warehouse,
        vbShipmentNumber: to.vbShipmentNumber,
        product: to.product,
        supplier: to.supplier,
        serialNumber: to.serialNumber,
        qty: to.qty || 0,
        releasedQty: released,
        availableQty,
        batchNumber: to.batchNumber,
        uom: to.uom,
        weight: to.weight,
        receivedDate: to.receivedDate,
      };
    });

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("Inventory Management GET Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
