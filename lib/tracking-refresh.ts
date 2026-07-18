import connectToDatabase from "@/lib/db";
import VBshipping from "@/lib/models/VBshipping";
import { mapSeaRatesToRow } from "@/lib/searates";

/**
 * Self-healing tracking data.
 *
 * The public tracker page and the shipment emails read the cached
 * shippingTrackingRecords[].raw_json in MongoDB. If that cache is missing
 * or stale, this helper fetches live from SeaRates (ONE api call), persists
 * it to VBshipping — exactly like /api/admin/searates-raw does for the
 * admin panel — and lets the caller re-read fresh data.
 *
 * Always best-effort: any failure (quota, network, bad container) leaves
 * the existing cache untouched and the caller renders what it has.
 */

const DEFAULT_MAX_AGE_HOURS = 6;

function mapStatus(raw: string): string {
  const s = (raw || "").toLowerCase().trim();
  if (s === "arrived" || s === "delivered") return "Delivered";
  if (s === "on water" || s === "in_transit" || s === "in transit") return "In Transit";
  if (s === "planned" || s === "booking confirmed") return "Planned";
  return "";
}

export async function ensureFreshTracking(
  containerNo: string,
  maxAgeHours: number = DEFAULT_MAX_AGE_HOURS
): Promise<{ refreshed: boolean; reason?: string }> {
  try {
    const container = String(containerNo || "").trim().toUpperCase();
    // Placeholders (TBD/TBA/short strings) are never trackable
    if (!container || container.length < 5 || container.startsWith("TBD") || container.startsWith("TBA")) {
      return { refreshed: false, reason: "placeholder-container" };
    }

    await connectToDatabase();
    const ship: any = await VBshipping.findOne(
      { containerNo: container },
      { containerNo: 1, status: 1, shippingTrackingRecords: { $slice: -1 } }
    ).lean();

    if (!ship) return { refreshed: false, reason: "shipment-not-found" };

    // Delivered shipments are disconnected from live tracking — container
    // numbers get reused by other businesses after delivery.
    const status = (ship.status || "").toLowerCase().trim();
    if (status === "delivered" || status === "arrived") {
      return { refreshed: false, reason: "delivered-disconnected" };
    }

    // ── Freshness check on the cached record ──
    const last = ship.shippingTrackingRecords?.[ship.shippingTrackingRecords.length - 1];
    if (last?.raw_json) {
      let hasRichData = false;
      try {
        const parsed = JSON.parse(last.raw_json);
        hasRichData = !!parsed?.data?.metadata;
      } catch {
        hasRichData = false;
      }
      const ageMs = last.timestamp ? Date.now() - new Date(last.timestamp).getTime() : Infinity;
      if (hasRichData && ageMs < maxAgeHours * 3600000) {
        return { refreshed: false, reason: "cache-fresh" };
      }
    }

    const apiKey = process.env.SEARATES_API_KEY || "";
    if (!apiKey) return { refreshed: false, reason: "no-api-key" };

    // ── ONE live SeaRates call (raw), mapped locally — no double spend ──
    const url = `https://tracking.searates.com/tracking?api_key=${encodeURIComponent(apiKey)}&number=${encodeURIComponent(container)}&route=true&ais=true`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return { refreshed: false, reason: `searates-http-${res.status}` };

    const rawJson = await res.json();
    if (rawJson?.status === "error") {
      return { refreshed: false, reason: `searates-${rawJson.message || "error"}` };
    }

    let mappedData: any = {};
    try {
      mappedData = mapSeaRatesToRow(rawJson);
    } catch {
      // raw_json alone is still valuable
    }

    const trackingRecord = {
      ...mappedData,
      raw_json: JSON.stringify(rawJson),
      timestamp: new Date(),
    };

    const updateOps: any = { $push: { shippingTrackingRecords: trackingRecord } };
    const setFields: any = {};
    const appStatus = mapStatus(mappedData.status);
    if (appStatus) setFields.status = appStatus;
    if (mappedData.pod_predictive_eta) setFields.updatedETA = new Date(mappedData.pod_predictive_eta);
    if (Object.keys(setFields).length > 0) updateOps.$set = setFields;

    await VBshipping.updateOne({ containerNo: container }, updateOps);

    return { refreshed: true };
  } catch (e: any) {
    console.error(`[ensureFreshTracking] ${containerNo}:`, e?.message || e);
    return { refreshed: false, reason: e?.message || "unknown-error" };
  }
}
