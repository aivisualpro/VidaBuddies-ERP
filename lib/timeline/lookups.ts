import VidaPO from "@/lib/models/VidaPO";
import VBcustomerPO from "@/lib/models/VBcustomerPO";
import VBshipping from "@/lib/models/VBshipping";

export interface LookupMaps {
  poMap: Record<string, string>;
  cpoMap: Record<string, string>;
  shipMap: Record<string, string>;
}

// ─── In-memory cache with TTL ───────────────────────────────────────────────
// buildLookups() scans 3 full collections and is called by both the timeline
// API and the reminders API. Caching avoids redundant full-scans.
const CACHE_TTL_MS = 60_000; // 60 seconds
let _lookupsCache: { data: LookupMaps; ts: number } | null = null;

/**
 * Build ID → display-name lookup maps for VidaTimeline enrichment.
 * Shared between the timeline API and the reminders API.
 * Results are cached in-memory for 60 seconds.
 */
export async function buildLookups(): Promise<LookupMaps> {
  // Return cached result if still fresh
  if (_lookupsCache && Date.now() - _lookupsCache.ts < CACHE_TTL_MS) {
    return _lookupsCache.data;
  }

  const [pos, cpos, ships] = await Promise.all([
    VidaPO.find({}, { _id: 1, VBNumber: 1 }).lean(),
    VBcustomerPO.find({}, { _id: 1, VBSerialNumber: 1, poNo: 1 }).lean(),
    VBshipping.find({}, { _id: 1, VBShipmentNumber: 1, svbid: 1 }).lean(),
  ]);

  const poMap: Record<string, string> = {};
  pos.forEach((p: any) => {
    const id = p._id.toString();
    const display = p.VBNumber || id;
    poMap[id] = display;
    // Also map display name → display name so string-based refs still resolve
    if (p.VBNumber) poMap[p.VBNumber] = display;
  });

  const cpoMap: Record<string, string> = {};
  cpos.forEach((c: any) => {
    const id = c._id.toString();
    const display = c.VBSerialNumber || c.poNo || id;
    cpoMap[id] = display;
    if (c.VBSerialNumber) cpoMap[c.VBSerialNumber] = display;
    if (c.poNo) cpoMap[c.poNo] = display;
  });

  const shipMap: Record<string, string> = {};
  ships.forEach((s: any) => {
    const id = s._id.toString();
    const display = s.VBShipmentNumber || s.svbid || id;
    shipMap[id] = display;
    if (s.VBShipmentNumber) shipMap[s.VBShipmentNumber] = display;
    if (s.svbid) shipMap[s.svbid] = display;
  });

  const data = { poMap, cpoMap, shipMap };
  _lookupsCache = { data, ts: Date.now() };
  return data;

}

/**
 * Invalidate the lookups cache (call after mutations to POs/CPOs/Ships).
 */
export function invalidateLookupsCache() {
  _lookupsCache = null;
}

/**
 * Enrich a single timeline entry with resolved display names.
 */
export function enrichTimelineEntry(
  item: any,
  { poMap, cpoMap, shipMap }: LookupMaps
) {
  const vbKey = item.VBNumber?.toString() || "";
  const serKey = item.VBSerialNumber?.toString() || "";
  const shipKey = item.VBShipmentNumber?.toString() || "";
  return {
    ...item,
    _VBNumberDisplay: vbKey ? (poMap[vbKey] || vbKey) : "",
    _VBSerialNumberDisplay: serKey ? (cpoMap[serKey] || serKey) : "",
    _VBShipmentNumberDisplay: shipKey ? (shipMap[shipKey] || shipKey) : "",
  };
}
