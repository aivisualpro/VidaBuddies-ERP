import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import CustomsPackage from "@/lib/models/CustomsPackage";
import VBshipping from "@/lib/models/VBshipping";
import VBcustomerPO from "@/lib/models/VBcustomerPO";
import VidaSupplier from "@/lib/models/VidaSupplier";
import { parseRawJson } from "@/lib/email/shipment-status-sender";
import {
  RULESET_VERSION,
  BROKERS,
  CANONICAL_FIELDS,
  computeDeadlines,
  packageTypesFor,
  requiredDocsFor,
  defaultDocState,
  type CustomsRoute,
  type ShipmentStage,
} from "@/lib/customs/rules";

/**
 * /api/admin/customs-packages
 *
 * GET  ?shipmentId=…            → latest package for the shipment (or null)
 * POST { shipmentId }           → create a draft (auto-detect route, prefill
 *                                 canonical fields from ERP + tracking) or
 *                                 return the existing active package.
 * PATCH { packageId, …updates } → autosave. Recomputes package types,
 *                                 document requirements and deadlines when the
 *                                 route or dates change. Appends audit events.
 *
 * Per spec: compliance starts at shipment level; the ERP never invents
 * PARS/PAPS references; unknown values stay blank.
 */

const toStr = (v: unknown): string => (v == null ? "" : String(v));

/** Auto-detect route from the shipment record — user confirms in step 1. */
function detectRoute(ship: any): CustomsRoute {
  const dest = `${toStr(ship?.portOfEntryShipTo)}`.toUpperCase();
  const usHints = [", US", "USA", "UNITED STATES", " NY", " NJ", " WA", " CA,", " TX", " IL", "NEW YORK", "SEATTLE", "TACOMA", "LOS ANGELES", "LONG BEACH", "OAKLAND", "SAVANNAH", "HOUSTON", "CHICAGO", "OTHELLO"];
  const caHints = ["CANADA", " ON", " BC", " QC", " AB", "TORONTO", "VANCOUVER", "MONTREAL", "PRINCE RUPERT", "HALIFAX", "CALGARY", "SASKAT", "WINNIPEG"];
  let country: "CA" | "US" = "CA";
  if (usHints.some((h) => dest.includes(h)) && !caHints.some((h) => dest.includes(h))) country = "US";

  // Container / vessel / ocean tracking → ocean, otherwise truck.
  const hasOcean = Boolean(ship?.containerNo || ship?.vessellTrip || (ship?.shippingTrackingRecords || []).length > 0);
  const borderMode = hasOcean ? "OCEAN" : "TRUCK";

  // Stage from dates.
  const now = Date.now();
  const etd = ship?.dateOfLanding ? new Date(ship.dateOfLanding).getTime() : null;
  const eta = ship?.updatedETA
    ? new Date(ship.updatedETA).getTime()
    : ship?.ETA
    ? new Date(ship.ETA).getTime()
    : null;
  let stage: ShipmentStage = "PRE_DEPARTURE";
  if (etd && now >= etd) stage = "IN_TRANSIT";
  if (eta && eta - now < 10 * 86400000 && eta > now) stage = "PRE_ARRIVAL";
  if (eta && now >= eta) stage = "ARRIVED";

  return { countryOfImport: country, borderMode, inlandMode: "NONE", stage };
}

/** Prefill canonical fields from ERP + latest tracking (source provenance kept). */
function buildFields(ship: any, cpo: any): any[] {
  const records = ship?.shippingTrackingRecords || [];
  const last = records.length ? records[records.length - 1] : null;
  const raw = parseRawJson(last?.raw_json);
  const d = raw?.data || {};
  const md = d.metadata || {};
  const aisVessel = d.route_data?.ais?.data?.vessel;

  const erp = (v: unknown, detail: string) =>
    v != null && String(v).trim() !== ""
      ? { value: String(v), source: "ERP", sourceDetail: detail, status: "verified" }
      : null;
  const trk = (v: unknown, detail: string) =>
    v != null && String(v).trim() !== ""
      ? { value: String(v), source: "TRACKING", sourceDetail: detail, status: "review" }
      : null;

  const packages = [ship?.drums ? `${ship.drums} drums` : "", ship?.pallets ? `${ship.pallets} pallets` : ""]
    .filter(Boolean)
    .join(", ");

  const valueByKey: Record<string, { value: string; source: string; sourceDetail: string; status: string } | null> = {
    importerName: { value: "Vida Buddies Inc.", source: "ERP", sourceDetail: "Company profile (confirm)", status: "review" },
    supplierName: erp(ship?.supplierName || ship?.supplier?.name, "Shipment → supplier"),
    consigneeName: { value: "", source: "ERP", sourceDetail: "Not on record", status: "missing" },
    shipToName: erp(ship?.portOfEntryShipTo, "Shipment → Port of entry / ship-to"),
    carrier: erp(ship?.carrier, "Shipment → carrier") || trk(md.sealine_name || last?.sealine_name, "SeaRates tracking"),
    vessel:
      erp(ship?.vessellTrip, "Shipment → vessel/trip") ||
      trk(aisVessel?.name || last?.vessel_names, "SeaRates tracking"),
    containerNo: erp(ship?.containerNo, "Shipment → container #"),
    bolNumber: erp(ship?.BOLNumber, "Shipment → BOL #"),
    bookingRef: erp(ship?.carrierBookingRef, "Shipment → booking ref"),
    portOfLading: erp(ship?.portOfLading, "Shipment → port of lading") || trk(last?.pol_name || last?.from_port_name, "SeaRates tracking"),
    portOfArrival: trk(last?.pod_name || last?.to_port_name, "SeaRates tracking"),
    portOfEntry: erp(ship?.portOfEntryShipTo, "Shipment → port of entry"),
    railTerminal: null,
    product: erp(ship?.product, "Shipment → product"),
    invoiceValue: erp(ship?.invValue, "Shipment → invoice value"),
    netWeightKG: erp(ship?.netWeightKG, "Shipment → net weight"),
    grossWeightKG: erp(ship?.grossWeightKG, "Shipment → gross weight"),
    packages: packages ? { value: packages, source: "ERP", sourceDetail: "Shipment → drums/pallets", status: "verified" } : null,
    supplierPO: erp(ship?.supplierPO, "Shipment → supplier PO"),
    customerPO: erp(cpo?.customerPONo, "Customer PO record"),
  };

  return CANONICAL_FIELDS.map((f) => {
    const v = valueByKey[f.key];
    return v
      ? { key: f.key, label: f.label, group: f.group, ...v }
      : { key: f.key, label: f.label, group: f.group, value: "", source: "ERP", sourceDetail: "", status: "missing" };
  });
}

/** Rebuild requirement list preserving matches already made. */
function rebuildDocuments(route: CustomsRoute, existing: any[]): any[] {
  const reqs = requiredDocsFor(route);
  return reqs.map((r) => {
    const prev = (existing || []).find((d: any) => d.docType === r.docType);
    if (prev?.fileId) return { ...(prev.toObject?.() || prev), label: r.label, readiness: r.readiness, note: r.note };
    return {
      docType: r.docType,
      label: r.label,
      readiness: r.readiness,
      state: defaultDocState(r, route.stage),
      included: true,
      note: r.note,
    };
  });
}

function refreshComputed(pkg: any) {
  const route: CustomsRoute = pkg.route;
  pkg.packageTypes = packageTypesFor(route);
  pkg.documents = rebuildDocuments(route, pkg.documents);
  pkg.deadlines = computeDeadlines(route, {
    etd: pkg.etd,
    ladingDate: pkg.ladingDate,
    eta: pkg.eta,
    borderEta: pkg.borderEta,
    lastFreeDay: pkg.lastFreeDay,
    sentAt: pkg.sends?.length ? pkg.sends[pkg.sends.length - 1].at : null,
  }).map((d) => ({ ...d, dueAt: new Date(d.dueAt as string) }));
}

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const shipmentId = req.nextUrl.searchParams.get("shipmentId");
    if (!shipmentId) return NextResponse.json({ error: "shipmentId required" }, { status: 400 });
    const pkg = await CustomsPackage.findOne({ shipmentId, status: { $ne: "SUPERSEDED" } })
      .sort({ version: -1 })
      .lean();
    return NextResponse.json({ package: pkg || null });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const { shipmentId } = await req.json();
    if (!shipmentId) return NextResponse.json({ error: "shipmentId required" }, { status: 400 });

    const existing = await CustomsPackage.findOne({ shipmentId, status: { $ne: "SUPERSEDED" } }).sort({ version: -1 });
    if (existing) return NextResponse.json({ package: existing, created: false });

    const ship: any = await VBshipping.findById(shipmentId)
      .populate({ path: "supplier", select: "name", model: VidaSupplier, strictPopulate: false })
      .populate({ path: "VBSerialNumber", select: "customerPONo poNo VBSerialNumber", model: VBcustomerPO, strictPopulate: false })
      .lean();
    if (!ship) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

    const route = detectRoute(ship);
    const broker = BROKERS[route.countryOfImport];
    const shipForFields = { ...ship, supplierName: (ship.supplier as any)?.name };

    const pkg = new CustomsPackage({
      shipmentId,
      shipNumber: ship.VBShipmentNumber || ship.svbid || String(shipmentId),
      vbNumber: ship.spoNo || "",
      containerNo: ship.containerNo || "",
      route,
      brokerCode: broker.code,
      brokerName: broker.name,
      brokerEmails: broker.defaultEmails,
      importerName: "Vida Buddies Inc.",
      etd: ship.dateOfLanding || undefined,
      ladingDate: ship.dateOfLanding || undefined,
      eta: ship.updatedETA || ship.ETA || undefined,
      borderEta: undefined,
      fields: buildFields(shipForFields, ship.VBSerialNumber),
      compliance: {
        portOfEntry: toStr(ship.portOfEntryShipTo),
        isFood: true,
        fsvpStatus: "UNKNOWN",
        priorNoticeRequired: route.countryOfImport === "US",
      },
      status: "DRAFT",
      version: 1,
      rulesetVersion: RULESET_VERSION,
      audit: [{ at: new Date(), action: "CREATED", detail: `Auto-detected route ${route.countryOfImport}/${route.borderMode}` }],
    });
    refreshComputed(pkg);
    await pkg.save();

    return NextResponse.json({ package: pkg, created: true });
  } catch (e: any) {
    console.error("[customs-packages POST]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const { packageId, ...updates } = body;
    if (!packageId) return NextResponse.json({ error: "packageId required" }, { status: 400 });

    const pkg: any = await CustomsPackage.findById(packageId);
    if (!pkg) return NextResponse.json({ error: "Package not found" }, { status: 404 });

    // Sent packages are immutable → editing supersedes into a new version.
    if (["SENT", "ACKNOWLEDGED", "RELEASED"].includes(pkg.status) && !updates.statusOnly) {
      pkg.status = "SUPERSEDED";
      await pkg.save();
      const next = new CustomsPackage({
        ...pkg.toObject(),
        _id: undefined,
        status: "DRAFT",
        version: pkg.version + 1,
        audit: [...pkg.audit, { at: new Date(), action: "AMENDED", detail: `Supersedes v${pkg.version}` }],
      });
      applyUpdates(next, updates);
      refreshComputed(next);
      await next.save();
      return NextResponse.json({ package: next, superseded: true });
    }

    const routeChanged = applyUpdates(pkg, updates);
    if (routeChanged) {
      pkg.audit.push({ at: new Date(), action: "ROUTE_CHANGED", detail: JSON.stringify(pkg.route) });
    }
    refreshComputed(pkg);
    await pkg.save();
    return NextResponse.json({ package: pkg });
  } catch (e: any) {
    console.error("[customs-packages PATCH]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** Apply whitelisted updates; returns true when route/dates changed. */
function applyUpdates(pkg: any, updates: any): boolean {
  let routeChanged = false;
  if (updates.route) {
    routeChanged = JSON.stringify(pkg.route) !== JSON.stringify({ ...pkg.route.toObject?.() || pkg.route, ...updates.route });
    pkg.route = { ...(pkg.route.toObject?.() || pkg.route), ...updates.route };
  }
  for (const k of ["etd", "ladingDate", "eta", "borderEta", "lastFreeDay"] as const) {
    if (k in updates) {
      pkg[k] = updates[k] ? new Date(updates[k]) : undefined;
      routeChanged = true;
    }
  }
  for (const k of ["brokerEmails", "importerName", "status", "fields", "extraFiles"] as const) {
    if (k in updates) pkg[k] = updates[k];
  }
  if (updates.compliance) {
    pkg.compliance = { ...(pkg.compliance.toObject?.() || pkg.compliance), ...updates.compliance };
  }
  if (updates.documentsPatch) {
    // [{docType, included?, state?}]
    for (const p of updates.documentsPatch) {
      const doc = pkg.documents.find((d: any) => d.docType === p.docType);
      if (doc) {
        if ("included" in p) doc.included = p.included;
        if ("state" in p) doc.state = p.state;
      }
    }
  }
  if (updates.generatedEntry) {
    pkg.generated.push({ ...updates.generatedEntry, at: new Date() });
    pkg.audit.push({ at: new Date(), action: "PACKAGE_GENERATED", detail: updates.generatedEntry.fileName });
  }
  if (updates.auditEntry) {
    pkg.audit.push({ at: new Date(), action: updates.auditEntry.action, detail: updates.auditEntry.detail, user: updates.auditEntry.user });
  }
  return routeChanged;
}
