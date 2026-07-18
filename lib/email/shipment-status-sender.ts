import VBshipping from "@/lib/models/VBshipping";
import { sendMail } from "@/lib/email/send";
import { buildTrackingUrl, publicAppUrl } from "@/lib/tracking-token";
import {
  renderShipmentStatusEmail,
  type ShipmentStatusEmailData,
} from "@/lib/email/templates/shipment-status";

/**
 * Shared shipment-status email builder/sender.
 * Used by the hourly cron (/api/cron/email-automations), the
 * "Send Now" endpoint (/api/admin/email-automations/send-now)
 * and the preview endpoint (/api/admin/email-automations/preview).
 */

export function isDeliveredStatus(raw?: string): boolean {
  const s = (raw || "").toUpperCase();
  return s.includes("DELIVER") || s.includes("ARRIV");
}

const byId = (arr: any[], id: string) => (arr || []).find((x: any) => x?.id === id);

/**
 * raw_json is persisted as a JSON *string* (see lib/searates.ts →
 * JSON.stringify). Parse it defensively — accept an already-parsed
 * object too, and never throw on malformed data.
 */
export function parseRawJson(raw: unknown): any | null {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return null;
}

/** "9.98, -83.03" → { lat, lng } | null */
function parseLatLong(s?: string): { lat: number; lng: number } | null {
  if (!s || typeof s !== "string") return null;
  const [latS, lngS] = s.split(",").map((p) => p.trim());
  const lat = Number(latS);
  const lng = Number(lngS);
  return isFinite(lat) && isFinite(lng) && (lat !== 0 || lng !== 0) ? { lat, lng } : null;
}

/** Extract the raw SeaRates status for a shipment's latest tracking record */
export function latestRawStatus(ship: any): string {
  const records = ship?.shippingTrackingRecords || [];
  const lastRecord = records.length > 0 ? records[records.length - 1] : null;
  const raw = parseRawJson(lastRecord?.raw_json);
  return raw?.data?.metadata?.status || lastRecord?.status || ship?.status || "";
}

const toStr = (v: unknown): string => (v == null ? "" : String(v));

/** Build email data from a VBshipping record + its latest raw_json (SeaRates) */
export function buildShipmentEmailData(
  ship: any,
  appUrl: string,
  delivered: boolean
): ShipmentStatusEmailData {
  const records = ship?.shippingTrackingRecords || [];
  const lastRecord = records.length > 0 ? records[records.length - 1] : null;
  // BUGFIX: raw_json is stored as a JSON string — it must be parsed before use.
  const raw = parseRawJson(lastRecord?.raw_json);

  const d = raw?.data || {};
  const md = d.metadata || {};
  const locations = d.locations || [];
  const vessels = d.vessels || [];
  const cont = d.containers?.[0] || {};
  const events = cont.events || [];
  const route = d.route || {};
  const routeData = d.route_data || {};
  const routeSegments = Array.isArray(routeData.route) ? routeData.route : [];
  const aisData = routeData.ais?.data || {};

  const polLoc = route.pol?.location != null ? byId(locations, route.pol.location) : null;
  const podLoc = route.pod?.location != null ? byId(locations, route.pod.location) : null;

  // Current position: AIS → route pin → flat latlong string fallback
  const pin = routeData.pin;
  const aisPos = aisData.last_vessel_position;
  const flatPos = parseLatLong(lastRecord?.latlong);
  const currentPos =
    aisPos?.lat != null && aisPos?.lng != null
      ? { lat: Number(aisPos.lat), lng: Number(aisPos.lng) }
      : Array.isArray(pin) && pin.length >= 2 && isFinite(pin[0]) && isFinite(pin[1])
      ? { lat: Number(pin[0]), lng: Number(pin[1]) }
      : flatPos;

  const etaStr =
    aisData.discharge_port?.date ||
    route.pod?.date ||
    lastRecord?.pod_date ||
    toStr(ship?.updatedETA) ||
    toStr(ship?.ETA);
  let etaDays: number | null = null;
  if (etaStr && !delivered) {
    const eta = new Date(String(etaStr).replace(" ", "T"));
    if (!isNaN(eta.getTime())) {
      etaDays = Math.ceil((eta.getTime() - Date.now()) / 86400000);
    }
  }

  const sortedEvents = [...events].sort(
    (a: any, b: any) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()
  );

  // If the rich event list is unavailable, fall back to the flat "last event" fields
  const fallbackEvents =
    sortedEvents.length === 0 && lastRecord?.last_event_status
      ? [
          {
            description: lastRecord.last_event_status || lastRecord.last_event_code || "Latest event",
            date: lastRecord.last_event_date || "",
            location: lastRecord.last_event_location || "",
            vessel: lastRecord.last_event_vessel || "",
            voyage: lastRecord.last_event_voyage || "",
            actual: true,
          },
        ]
      : [];

  return {
    containerNo: ship?.containerNo || "",
    carrier: md.sealine_name || md.sealine || lastRecord?.sealine_name || lastRecord?.sealine || ship?.carrier || "",
    status: delivered ? "DELIVERED" : md.status || lastRecord?.status || ship?.status || "IN_TRANSIT",
    fromName: polLoc?.name || lastRecord?.pol_name || lastRecord?.from_port_name || ship?.portOfLading || "",
    fromCountry: polLoc?.country || lastRecord?.from_port_country || "",
    toName: podLoc?.name || lastRecord?.pod_name || lastRecord?.to_port_name || ship?.portOfEntryShipTo || "",
    toCountry: podLoc?.country || lastRecord?.to_port_country || "",
    departureDate: route.pol?.date || aisData.departure_port?.date || lastRecord?.pol_date || "",
    arrivalDate:
      route.pod?.date || aisData.discharge_port?.date || lastRecord?.pod_date || toStr(ship?.updatedETA) || toStr(ship?.ETA) || "",
    predictiveEta: route.pod?.predictive_eta || lastRecord?.pod_predictive_eta || "",
    containerType: cont.size_type || cont.iso_code || lastRecord?.container_size_type || lastRecord?.container_iso_code || "",
    vesselName: aisData.vessel?.name || lastRecord?.vessel_names || ship?.vesselName || "",
    vesselImo: aisData.vessel?.imo ? String(aisData.vessel.imo) : toStr(lastRecord?.vessel_imos).split(",")[0]?.trim() || "",
    vesselFlag: aisData.vessel?.flag || "",
    etaDays,
    currentLat: currentPos?.lat,
    currentLng: currentPos?.lng,
    positionUpdatedAt: aisPos?.updated_at || lastRecord?.updated_at || "",
    segments: routeSegments.map((seg: any) => ({
      vessel: seg.vessel?.name,
      from: seg.from?.name,
      to: seg.to?.name,
    })),
    events:
      sortedEvents.length > 0
        ? sortedEvents.map((ev: any) => {
            const evLoc = ev.location != null ? byId(locations, ev.location) : null;
            const evVessel = ev.vessel != null ? byId(vessels, ev.vessel) : null;
            return {
              description: ev.description || ev.status || ev.event_code || "Event",
              date: ev.date,
              location: evLoc ? `${evLoc.name}${evLoc.country ? `, ${evLoc.country}` : ""}` : "",
              vessel: evVessel?.name || "",
              voyage: ev.voyage || "",
              actual: ev.actual === true,
            };
          })
        : fallbackEvents,
    appUrl,
    // Secure public tracker link (no login) — used as the email CTA
    trackUrl: ship?.containerNo ? buildTrackingUrl(ship.containerNo) : undefined,
    delivered,
  };
}

/** Load a shipment (latest tracking record only) and email its status snapshot. */
export async function sendShipmentStatusNow(
  containerNo: string,
  recipients: string[]
): Promise<{ success: boolean; error?: string; delivered?: boolean }> {
  const ship = await VBshipping.findOne(
    { containerNo },
    { driveDocuments: 0, shippingTrackingRecords: { $slice: -1 } }
  ).lean();

  if (!ship) return { success: false, error: `Shipment not found for container ${containerNo}` };

  const delivered = isDeliveredStatus(latestRawStatus(ship));

  // Always link externals to the public origin — never localhost
  const appUrl = publicAppUrl();
  const data = buildShipmentEmailData(ship, appUrl, delivered);
  const { subject, html, text } = renderShipmentStatusEmail(data);
  const result = await sendMail({ to: recipients, subject, html, text });

  return { success: result.success, error: result.error, delivered };
}
