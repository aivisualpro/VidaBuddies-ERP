import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import mongoose from "mongoose";

import "@/lib/models/VBshipping";
import "@/lib/models/VBcustomerPO";
import "@/lib/models/VidaPO";

/**
 * GET /api/admin/andres-tracker/page-data
 * Single optimised endpoint for the Andres Tracker page.
 * Returns { ships, cpos, pos } with all references resolved server-side.
 */
export async function GET() {
  try {
    await connectToDatabase();
    const db = mongoose.connection.db!;

    const [rawShips, rawCpos, rawPos] = await Promise.all([
      db.collection("vbshippings").aggregate([
        // Compute ETA from the last shippingTrackingRecord before stripping the array
        {
          $addFields: {
            _lastTrack: { $arrayElemAt: ["$shippingTrackingRecords", -1] },
          },
        },
        {
          $addFields: {
            _trackingETA: {
              $ifNull: ["$_lastTrack.pod_predictive_eta", { $ifNull: ["$_lastTrack.pod_date", null] }],
            },
            _trackingFromPort: "$_lastTrack.from_port_name",
            _trackingToPort: "$_lastTrack.to_port_name",
          },
        },
        {
          $project: {
            shippingTrackingRecords: 0,
            driveDocuments: 0,
            raw_json: 0,
            _lastTrack: 0,
          },
        },
      ]).toArray(),
      db.collection("vbcustomerpos").find(
        {},
        { projection: { VBNumber: 1, VBSerialNumber: 1, customer: 1, customerPONo: 1, customerPODate: 1, qtyOrdered: 1, qtyReceived: 1, warehouse: 1, isDirectShipment: 1, products: 1 } }
      ).toArray(),
      db.collection("vidapos").find(
        { isArchived: { $ne: true } },
        { projection: { VBNumber: 1, orderType: 1, date: 1, isArchived: 1, customerPO: 1 } }
      ).toArray(),
    ]);

    const poIds = new Set<string>();
    const cpoIds = new Set<string>();
    const supIds = new Set<string>();
    const locIds = new Set<string>();
    const prodIds = new Set<string>();
    const custIds = new Set<string>();
    const whIds = new Set<string>();

    for (const s of rawShips) {
      if (s.VBNumber) poIds.add(s.VBNumber.toString());
      if (s.VBSerialNumber) cpoIds.add(s.VBSerialNumber.toString());
      if (s.supplier) supIds.add(s.supplier.toString());
      if (s.supplierLocation) locIds.add(s.supplierLocation.toString());
      if (Array.isArray(s.products)) s.products.forEach((p: any) => p && prodIds.add(p.toString()));
    }
    for (const c of rawCpos) {
      if (c.customer) custIds.add(c.customer.toString());
      if (c.warehouse) whIds.add(c.warehouse.toString());
    }

    const isOid = (id: string) => /^[a-f\d]{24}$/i.test(id);
    const toOids = (ids: Set<string>) => [...ids].filter(isOid).map(id => new mongoose.Types.ObjectId(id));

    const [posDocs, cpoDocs, supDocs, prodDocs, custDocs, whDocs] = await Promise.all([
      poIds.size > 0 ? db.collection("vidapos").find({ _id: { $in: toOids(poIds) } }, { projection: { VBNumber: 1 } }).toArray() : [],
      cpoIds.size > 0 ? db.collection("vbcustomerpos").find({ _id: { $in: toOids(cpoIds) } }, { projection: { VBSerialNumber: 1, customer: 1, customerPONo: 1, warehouse: 1 } }).toArray() : [],
      supIds.size > 0 ? db.collection("vidasuppliers").find({ _id: { $in: toOids(supIds) } }, { projection: { name: 1, vbId: 1, location: 1 } }).toArray() : [],
      prodIds.size > 0 ? db.collection("vidaproducts").find({ _id: { $in: toOids(prodIds) } }, { projection: { name: 1, vbId: 1 } }).toArray() : [],
      custIds.size > 0 ? db.collection("vidacustomers").find({ _id: { $in: toOids(custIds) } }, { projection: { name: 1, vbId: 1 } }).toArray() : [],
      whIds.size > 0 ? db.collection("vidawarehouses").find({ _id: { $in: toOids(whIds) } }, { projection: { name: 1 } }).toArray() : [],
    ]);

    const poMap = new Map<string, string>();
    for (const p of posDocs) poMap.set(p._id.toString(), (p as any).VBNumber || p._id.toString());

    const cpoSnMap = new Map<string, string>();
    const cpoDetailMap = new Map<string, any>();
    for (const c of cpoDocs) {
      const id = c._id.toString();
      cpoSnMap.set(id, (c as any).VBSerialNumber || id);
      cpoDetailMap.set(id, {
        customer: (c as any).customer?.toString() || null,
        customerPONo: (c as any).customerPONo || null,
        warehouse: (c as any).warehouse?.toString() || null,
      });
    }

    const supMap = new Map<string, string>();
    const locMap = new Map<string, string>();
    for (const s of supDocs) {
      supMap.set(s._id.toString(), (s as any).name || (s as any).vbId || s._id.toString());
      if (Array.isArray((s as any).location)) {
        for (const loc of (s as any).location) {
          if (loc._id) locMap.set(loc._id.toString(), loc.locationName || loc.vbId || "Unknown");
        }
      }
    }

    const unresSup = [...supIds].filter(id => !supMap.has(id) && isOid(id));
    const unresLoc = [...locIds].filter(id => !locMap.has(id) && isOid(id));
    const allUnres = [...new Set([...unresSup, ...unresLoc])];
    if (allUnres.length > 0) {
      const fallback = await db.collection("vidasuppliers").find(
        { "location._id": { $in: allUnres.map(id => new mongoose.Types.ObjectId(id)) } },
        { projection: { name: 1, vbId: 1, location: 1 } }
      ).toArray();
      for (const s of fallback) {
        if (Array.isArray((s as any).location)) {
          for (const loc of (s as any).location) {
            if (loc._id) {
              const lid = loc._id.toString();
              if (unresSup.includes(lid)) supMap.set(lid, (s as any).name || (s as any).vbId || s._id.toString());
              if (!locMap.has(lid)) locMap.set(lid, loc.locationName || loc.vbId || "Unknown");
            }
          }
        }
      }
    }

    const prodMap = new Map<string, string>();
    for (const p of prodDocs) prodMap.set(p._id.toString(), (p as any).name || (p as any).vbId || p._id.toString());

    const custMap = new Map<string, string>();
    for (const c of custDocs) custMap.set(c._id.toString(), (c as any).name || (c as any).vbId || c._id.toString());

    const whMap = new Map<string, string>();
    for (const w of whDocs) whMap.set(w._id.toString(), (w as any).name || w._id.toString());

    const ships = rawShips.map((item: any) => {
      const cpoId = item.VBSerialNumber ? item.VBSerialNumber.toString() : "";
      const detail = cpoId ? cpoDetailMap.get(cpoId) : null;
      return {
        ...item,
        _displayVBNumber: item.VBNumber ? poMap.get(item.VBNumber.toString()) || item.VBNumber.toString() : "",
        _displayVBSerialNumber: cpoId ? cpoSnMap.get(cpoId) || cpoId : "",
        _displaySupplier: item.supplier ? supMap.get(item.supplier.toString()) || item.supplier.toString() : "",
        _displaySupplierLocation: item.supplierLocation ? locMap.get(item.supplierLocation.toString()) || item.supplierLocation.toString() : "",
        _displayProducts: Array.isArray(item.products) ? item.products.map((p: any) => prodMap.get(p.toString()) || p.toString()) : [],
        _displayCustomer: detail?.customer ? custMap.get(detail.customer) || detail.customer : "",
        _customerId: detail?.customer || null,
        _displayCustomerPONo: detail?.customerPONo || "",
        _displayWarehouse: detail?.warehouse ? whMap.get(detail.warehouse) || detail.warehouse : "",
      };
    });

    const cpos = rawCpos.map((c: any) => {
      const custId = c.customer ? c.customer.toString() : null;
      const whId = c.warehouse ? c.warehouse.toString() : null;
      return {
        ...c,
        _displayCustomer: custId ? custMap.get(custId) || custId : "",
        _displayWarehouse: whId ? whMap.get(whId) || whId : "",
      };
    });

    return NextResponse.json({ ships, cpos, pos: rawPos });
  } catch (error) {
    console.error("[andres-tracker/page-data] error:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
