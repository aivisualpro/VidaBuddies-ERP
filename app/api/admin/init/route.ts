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
import VBcustomerPO from "@/lib/models/VBcustomerPO";
import VBshipping from "@/lib/models/VBshipping";
import { decryptPassword } from "@/lib/encryption";

// Ensure all populated models are registered for release-request population
const _models = { VidaProduct, VidaWarehouse, VidaCustomer, VidaUser };

export const dynamic = "force-dynamic";

// ─── In-memory cache with TTL ───────────────────────────────────────────────
// Shared across requests in the same server process.  Invalidated after
// CACHE_TTL_MS or on any POST/PUT/DELETE to a data-mutating admin endpoint
// (callers can bust by hitting GET /api/admin/init?bust=1).
const CACHE_TTL_MS = 30_000; // 30 seconds
let _cache: { data: any; ts: number } | null = null;

// Fields to EXCLUDE from PO docs during the query — shippingTrackingRecords
// and driveDocuments are huge arrays that no init consumer needs.
const PO_HEAVY_FIELDS_EXCLUSION = {
  "customerPO.shipping.shippingTrackingRecords": 0,
  "customerPO.shipping.raw_json": 0,
  "driveDocuments": 0,
};
const STANDALONE_SHIP_EXCLUSION = {
  shippingTrackingRecords: 0,
  driveDocuments: 0,
  raw_json: 0,
};

export async function GET(request: Request) {
  try {
    // ── Cache check ──────────────────────────────────────────────────────
    const url = new URL(request.url);
    const bustCache = url.searchParams.get("bust") === "1";

    if (!bustCache && _cache && Date.now() - _cache.ts < CACHE_TTL_MS) {
      console.log("[init] cache HIT — serving from memory");
      return NextResponse.json(_cache.data);
    }

    console.time("[init] total");
    console.time("[init] db-connect");
    await connectToDatabase();
    console.timeEnd("[init] db-connect");

    // ── Parallel queries ─────────────────────────────────────────────────
    // Split into two tiers so the heaviest queries don't block lightweight ones.
    console.time("[init] queries");
    const [pos, releases, products, categories, warehouses, suppliersRaw, customers, users, carriers, standaloneCPOs, standaloneShips] =
      await Promise.all([
        VidaPO.find({}, PO_HEAVY_FIELDS_EXCLUSION).lean(),
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
        VidaSupplier.find({ isDeleted: { $ne: true } }).lean(),
        VidaCustomer.find({}).lean(),
        VidaUser.find({}).lean(),
        VidaCarrier.find({}).sort({ name: 1 }).lean(),
        VBcustomerPO.find({}).lean(),
        VBshipping.find({}, STANDALONE_SHIP_EXCLUSION).lean(),
      ]);
    console.timeEnd("[init] queries");

    // ── Post-processing (all synchronous, CPU-bound) ─────────────────────
    console.time("[init] post-process");

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

    // ── Merge standalone CPOs & shippings into PO objects ──
    // Group standalone shippings by their parent CPO ObjectId (VBSerialNumber field)
    const shipsByCpoId = new Map<string, any[]>();
    (standaloneShips as any[]).forEach((ship: any) => {
      const key = ship.VBSerialNumber?.toString() || "";
      if (key) {
        if (!shipsByCpoId.has(key)) shipsByCpoId.set(key, []);
        shipsByCpoId.get(key)!.push(ship);
      }
    });

    // Group standalone CPOs by their parent PO ObjectId (VBNumber field)
    const cposByPoId = new Map<string, any[]>();
    (standaloneCPOs as any[]).forEach((cpo: any) => {
      const key = cpo.VBNumber?.toString() || "";
      if (key) {
        // Attach matching shippings to this CPO
        const cpoId = cpo._id?.toString() || "";
        const cpoWithShipping = {
          ...cpo,
          poNo: cpo.VBSerialNumber || cpo.poNo || "",
          shipping: shipsByCpoId.get(cpoId) || [],
        };
        if (!cposByPoId.has(key)) cposByPoId.set(key, []);
        cposByPoId.get(key)!.push(cpoWithShipping);
      }
    });

    // Merge: prefer standalone CPOs over embedded ones
    for (const po of pos as any[]) {
      const poId = po._id?.toString() || "";
      const standaloneCPOsForPO = cposByPoId.get(poId);
      if (standaloneCPOsForPO && standaloneCPOsForPO.length > 0) {
        // Use standalone CPOs (they are the source of truth)
        po.customerPO = standaloneCPOsForPO;
      } else if (po.customerPO && Array.isArray(po.customerPO)) {
        // Keep embedded CPOs as fallback, but filter out Mongoose empty dummy records
        // and attach standalone shippings
        po.customerPO = po.customerPO
          .filter((cpo: any) => cpo.poNo || cpo.VBSerialNumber || cpo.customer || (cpo.qtyOrdered && cpo.qtyOrdered > 0))
          .map((cpo: any) => {
            const cpoId = cpo._id?.toString() || "";
            const standaloneShipsForCPO = shipsByCpoId.get(cpoId);
            if (standaloneShipsForCPO && standaloneShipsForCPO.length > 0) {
              return { ...cpo, shipping: standaloneShipsForCPO };
            }
            if (cpo.shipping && Array.isArray(cpo.shipping)) {
              cpo.shipping = cpo.shipping.filter((ship: any) => ship.svbid || ship.VBShipmentNumber || ship.supplier);
            }
            return cpo;
          });
      }
    }

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
                vbpoNo: po.VBNumber,
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

    console.timeEnd("[init] post-process");

    const responseData = {
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
    };

    // ── Populate cache ───────────────────────────────────────────────────
    _cache = { data: responseData, ts: Date.now() };

    console.timeEnd("[init] total");
    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error("Init API Error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch init data" }, { status: 500 });
  }
}
