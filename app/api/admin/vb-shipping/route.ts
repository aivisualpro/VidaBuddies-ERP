import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VBshipping from "@/lib/models/VBshipping";
import mongoose from "mongoose";

// Fields to EXCLUDE — shippingTrackingRecords and driveDocuments are huge
// and no list-view consumer needs them.
const LIST_PROJECTION = {
  shippingTrackingRecords: 0,
  driveDocuments: 0,
  raw_json: 0,
};

/**
 * GET /api/admin/vb-shipping
 * Query params:
 *   - customerPOId: filter by parent customerPO
 *   - VBNumber: filter by VBNumber (vidapos._id)
 *   - VBSerialNumber: filter by VBSerialNumber (vbcustomerpos._id)
 *   - poNo: filter by poNo display string
 *   - containerNo: filter by container number
 *   - all (no params): return all
 *
 * Denormalization: resolves ObjectId refs to display names:
 *   _displayVBNumber, _displayVBSerialNumber, _displaySupplier,
 *   _displaySupplierLocation, _displayProducts
 */
export async function GET(req: Request) {
  try {
    console.time("[vb-shipping] total");
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const VBNumber = searchParams.get("VBNumber");
    const VBSerialNumber = searchParams.get("VBSerialNumber");
    const containerNo = searchParams.get("containerNo");

    const filter: any = {};
    if (VBNumber) {
      // Support both ObjectId and string matching
      if (/^[a-fA-F0-9]{24}$/.test(VBNumber)) {
        filter.VBNumber = new mongoose.Types.ObjectId(VBNumber);
      } else {
        filter.VBNumber = VBNumber;
      }
    }
    if (VBSerialNumber) {
      if (/^[a-fA-F0-9]{24}$/.test(VBSerialNumber)) {
        filter.VBSerialNumber = new mongoose.Types.ObjectId(VBSerialNumber);
      } else {
        filter.VBSerialNumber = VBSerialNumber;
      }
    }
    if (containerNo) filter.containerNo = containerNo;

    const items = await VBshipping.find(filter, LIST_PROJECTION)
      .sort({ createdAt: -1 })
      .lean();

    // ─── Denormalize: resolve ObjectIds → display names ───
    const db = mongoose.connection.db;

    // Collect unique ObjectIds per field
    const poIds = new Set<string>();
    const cpoIds = new Set<string>();
    const supIds = new Set<string>();
    const locIds = new Set<string>();
    const prodIds = new Set<string>();

    for (const item of items) {
      if (item.VBNumber) poIds.add(item.VBNumber.toString());
      if (item.VBSerialNumber) cpoIds.add(item.VBSerialNumber.toString());
      if (item.supplier) supIds.add(item.supplier.toString());
      if (item.supplierLocation) locIds.add(item.supplierLocation.toString());
      if (item.products && Array.isArray(item.products)) {
        item.products.forEach((p: any) => { if (p) prodIds.add(p.toString()); });
      }
    }

    // Batch fetch all referenced documents
    const [posDocs, cpoDocs, supDocs, prodDocs] = await Promise.all([
      poIds.size > 0
        ? db!.collection("vidapos").find(
            { _id: { $in: [...poIds].map(id => new mongoose.Types.ObjectId(id)) } },
            { projection: { VBNumber: 1 } }
          ).toArray()
        : [],
      cpoIds.size > 0
        ? db!.collection("vbcustomerpos").find(
            { _id: { $in: [...cpoIds].map(id => new mongoose.Types.ObjectId(id)) } },
            { projection: { VBSerialNumber: 1 } }
          ).toArray()
        : [],
      supIds.size > 0
        ? db!.collection("vidasuppliers").find(
            { _id: { $in: [...supIds].map(id => new mongoose.Types.ObjectId(id)) } },
            { projection: { name: 1, vbId: 1, location: 1 } }
          ).toArray()
        : [],
      prodIds.size > 0
        ? db!.collection("vidaproducts").find(
            { _id: { $in: [...prodIds].map(id => new mongoose.Types.ObjectId(id)) } },
            { projection: { name: 1, vbId: 1 } }
          ).toArray()
        : [],
    ]);

    // Build lookup maps
    const poMap = new Map<string, string>();
    for (const po of posDocs) poMap.set(po._id.toString(), po.VBNumber || po._id.toString());

    const cpoMap = new Map<string, string>();
    for (const cpo of cpoDocs) cpoMap.set(cpo._id.toString(), (cpo as any).VBSerialNumber || cpo._id.toString());

    const supMap = new Map<string, string>();
    const locMap = new Map<string, string>();
    for (const sup of supDocs) {
      supMap.set(sup._id.toString(), sup.name || sup.vbId || sup._id.toString());
      // Build location subdoc lookup
      if (sup.location && Array.isArray(sup.location)) {
        for (const loc of sup.location) {
          if (loc._id) locMap.set(loc._id.toString(), loc.locationName || loc.vbId || 'Unknown');
        }
      }
    }

    // Fallback: some shipping records store a supplier location subdoc _id
    // in the `supplier` field instead of the parent supplier _id.
    // Find any unresolved supplier IDs and try matching by location._id.
    const unresolvedSupIds = [...supIds].filter(id => !supMap.has(id));
    // Also collect any supplierLocation IDs not yet in locMap
    const unresolvedLocIds = [...locIds].filter(id => !locMap.has(id));
    const allUnresolved = [...new Set([...unresolvedSupIds, ...unresolvedLocIds])];

    if (allUnresolved.length > 0) {
      const fallbackSups = await db!.collection("vidasuppliers").find(
        { "location._id": { $in: allUnresolved.map(id => new mongoose.Types.ObjectId(id)) } },
        { projection: { name: 1, vbId: 1, location: 1 } }
      ).toArray();

      for (const sup of fallbackSups) {
        if (sup.location && Array.isArray(sup.location)) {
          for (const loc of sup.location) {
            if (loc._id) {
              const locIdStr = loc._id.toString();
              // If a supplier field held this location _id, resolve it to the supplier name
              if (unresolvedSupIds.includes(locIdStr)) {
                supMap.set(locIdStr, sup.name || sup.vbId || sup._id.toString());
              }
              // Also populate location name if missing
              if (!locMap.has(locIdStr)) {
                locMap.set(locIdStr, loc.locationName || loc.vbId || 'Unknown');
              }
            }
          }
        }
      }
    }

    const prodMap = new Map<string, string>();
    for (const prod of prodDocs) prodMap.set(prod._id.toString(), prod.name || prod.vbId || prod._id.toString());

    // Attach _display fields
    const enriched = items.map((item: any) => ({
      ...item,
      _displayVBNumber: item.VBNumber ? poMap.get(item.VBNumber.toString()) || item.VBNumber.toString() : '',
      _displayVBSerialNumber: item.VBSerialNumber ? cpoMap.get(item.VBSerialNumber.toString()) || item.VBSerialNumber.toString() : '',
      _displaySupplier: item.supplier ? supMap.get(item.supplier.toString()) || item.supplier.toString() : '',
      _displaySupplierLocation: item.supplierLocation ? locMap.get(item.supplierLocation.toString()) || item.supplierLocation.toString() : '',
      _displayProducts: Array.isArray(item.products)
        ? item.products.map((p: any) => prodMap.get(p.toString()) || p.toString())
        : [],
    }));

    console.timeEnd("[vb-shipping] total");
    return NextResponse.json(enriched);
  } catch (error) {
    console.error("Failed to fetch VBshipping:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

/**
 * POST /api/admin/vb-shipping
 * Create a new standalone shipping record.
 */
export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const data = await req.json();

    // Sanitize ObjectId fields — empty strings → null
    const oidFields = ['VBNumber', 'VBSerialNumber', 'supplier', 'supplierLocation'];
    for (const f of oidFields) {
      if (data[f] === '' || data[f] === undefined) data[f] = null;
    }
    // Sanitize products array
    if (Array.isArray(data.products)) {
      data.products = data.products.filter((p: any) => p && typeof p === 'string' && /^[a-fA-F0-9]{24}$/.test(p));
    }

    const newItem = await VBshipping.create(data);
    return NextResponse.json(newItem, { status: 201 });
  } catch (error) {
    console.error("Failed to create VBshipping:", error);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
