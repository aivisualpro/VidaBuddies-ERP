import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaPO from "@/lib/models/VidaPO";
import VidaReleaseRequest from "@/lib/models/VidaReleaseRequest";
import VidaProduct from "@/lib/models/VidaProduct";
import VidaCategory from "@/lib/models/VidaCategory";
import VidaWarehouse from "@/lib/models/VidaWarehouse";
import VidaSupplier from "@/lib/models/VidaSupplier";
import VidaCustomer from "@/lib/models/VidaCustomer";
import VidaUser from "@/lib/models/VidaUser";
import VidaCarrier from "@/lib/models/VidaCarrier";
import { decryptPassword } from "@/lib/encryption";

// Ensure all populated models are registered for release-request population
const _models = { VidaProduct, VidaWarehouse, VidaCustomer, VidaUser };

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectToDatabase();

    // Single DB connection, all queries in parallel
    const [pos, releases, products, categories, warehouses, suppliersRaw, customers, users, carriers] =
      await Promise.all([
        VidaPO.find({}).lean(),
        VidaReleaseRequest.find()
          .populate("warehouse", "name")
          .populate("customer", "name location")
          .populate("requestedBy", "name email")
          .populate({
            path: "releaseOrderProducts.product",
            model: _models.VidaProduct.modelName,
            select: "name vbId",
          })
          .sort({ createdAt: -1 })
          .lean(),
        VidaProduct.find({}).lean(),
        VidaCategory.find({}).lean(),
        VidaWarehouse.find({}).lean(),
        VidaSupplier.find({}).lean(),
        VidaCustomer.find({}).lean(),
        VidaUser.find({}).lean(),
        VidaCarrier.find({}).sort({ name: 1 }).lean(),
      ]);

    // Decrypt supplier passwords (matches existing supplier route logic)
    const suppliers = suppliersRaw.map((item: any) => ({
      ...item,
      portalPassword: item.portalPassword ? decryptPassword(item.portalPassword as string) : null,
    }));

    // Build andresTracker inline (matches existing andres-tracker route logic)
    const customerMap = new Map(customers.map((c: any) => [c.vbId, c.name]));
    const productMap = new Map<string, string>();
    products.forEach((p: any) => {
      if (p.vbId) productMap.set(p.vbId, p.name);
      if (p._id) productMap.set(p._id.toString(), p.name);
    });

    const supplierLocationMap = new Map();
    suppliersRaw.forEach((s: any) => {
      if (s.location && Array.isArray(s.location)) {
        s.location.forEach((loc: any) => {
          if (loc.vbId) {
            const locLabel = loc.locationName ? `${s.name} — ${loc.locationName}` : s.name;
            supplierLocationMap.set(loc.vbId, locLabel);
          }
        });
      }
    });

    const andresTracker: any[] = [];
    for (const po of pos as any[]) {
      if (po.customerPO && Array.isArray(po.customerPO)) {
        for (const cpo of po.customerPO) {
          if (cpo.shipping && Array.isArray(cpo.shipping)) {
            for (const ship of cpo.shipping) {
              andresTracker.push({
                _id: ship._id,
                poId: po._id,
                cpoId: cpo._id,
                shipId: ship._id,
                vbpoNo: po.vbpoNo,
                orderType: po.orderType,
                poNo: cpo.poNo,
                customer: cpo.customer ? (customerMap.get(cpo.customer) || cpo.customer) : "",
                customerLocation: cpo.customerLocation,
                customerPONo: cpo.customerPONo,
                qtyOrdered: cpo.qtyOrdered,
                warehouse: cpo.warehouse,
                spoNo: ship.spoNo,
                svbid: ship.svbid,
                supplierLocationId: ship.supplierLocation
                  ? supplierLocationMap.get(ship.supplierLocation) || ship.supplierLocation
                  : "",
                product: (() => {
                  const pids =
                    Array.isArray(ship.products) && ship.products.length > 0
                      ? ship.products
                      : ship.product
                        ? [ship.product]
                        : [];
                  return pids.map((pid: string) => productMap.get(pid) || pid).join(", ") || "";
                })(),
                BOLNumber: ship.BOLNumber,
                carrier: ship.carrier,
                vessellTrip: ship.vessellTrip,
                updatedETA: ship.updatedETA || ship.ETA,
                estimatedDuties: ship.estimatedDuties,
                quickNote: ship.quickNote,
                portofEntryShipto: ship.portOfEntryShipTo,
                itemNo: ship.itemNo,
                description: ship.description,
                lotSerial: ship.lotSerial,
                qty: ship.qty,
                type: ship.type,
                inventoryDate: ship.inventoryDate,
                carrierBookingRef: ship.carrierBookingRef,
                isManufacturerSecurityISF: ship.isManufacturerSecurityISF,
                ISF: ship.isVidaBuddiesISFFiling ? "Yes" : "No",
                trackingId: ship.updateShipmentTracking,
                status: ship.status || "",
                customsStatus: ship.isCustomsStatus ? "Cleared" : "Pending",
                documentsRequired: ship.isAllDocumentsProvidedToCustomsBroker
                  ? "All Provided"
                  : "Missing",
                container: ship.containerNo,
                vbid: ship.svbid,
              });
            }
          }
        }
      }
    }

    return NextResponse.json({
      purchaseOrders: pos,
      releaseRequests: releases,
      products,
      categories,
      warehouses,
      suppliers,
      customers,
      users,
      carriers,
      andresTracker,
    });
  } catch (error: any) {
    console.error("Init API Error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch init data" }, { status: 500 });
  }
}
