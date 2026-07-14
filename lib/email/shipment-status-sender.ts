import VBshipping from "@/lib/models/VBshipping";
import { sendMail } from "@/lib/email/send";
import {
  renderShipmentStatusEmail,
  type ShipmentStatusEmailData,
} from "@/lib/email/templates/shipment-status";

/**
 * Shared shipment-status email builder/sender.
 * Used by the hourly cron (/api/cron/email-automations) and the
 * "Send Now" endpoint (/api/admin/email-automations/send-now).
 */

export function isDeliveredStatus(raw?: string): boolean {
  const s = (raw || "").toUpperCase();
  return s.includes("DELIVER") || s.includes("ARRIV");
}

const byId = (arr: any[], id: string) => (arr || []).find((x: any) => x?.id === id);

/** Build email data from a VBshipping record + its latest raw_json (SeaRates) */
export function buildShipmentEmailData(
  ship: any,
  appUrl: string,
  delivered: boolean
): ShipmentStatusEmailData {
  const records = ship?.shippingTrackingRecords || [];
  const lastRecord = records.length > 0 ? records[records.length - 1] : null;
  const raw = lastRecord?.raw_json;

  const d = raw?.data || {};
  const md = d.metadata || {};
  const locations = d.locations || [];
  const vessels = d.vessels || [];
  const cont = d.containers?.[0] || {};
  const events = cont.events || [];
  const route = d.route || {};
  const routeData = d.route_data || {};
  const routeSegments = routeData.route || [];
  const aisData = routeData.ais?.data || {};

  const polLoc = route.pol?.location ? byId(locations, route.pol.location) : null;
  const podLoc = route.pod?.location ? byId(locations, route.pod.location) : null;

  const pin = routeData.pin;
  const aisPos = routeData.ais?.data?.last_vessel_position;
  const currentPos = aisPos?.lat ? aisPos : pin ? { lat: pin[0], lng: pin[1] } : null;

  const etaStr = aisData.discharge_port?.date || route.pod?.date || ship?.updatedETA || ship?.ETA;
  let etaDays: number | null = null;
  if (etaStr) {
    const eta = new Date(String(etaStr).replace(" ", "T"));
    if (!isNaN(eta.getTime())) {
      etaDays = Math.ceil((eta.getTime() - Date.now()) / 86400000);
    }
  }

  const sortedEvents = [...events].sort(
    (a: any, b: any) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()
  );

  return {
    containerNo: ship?.containerNo || "",
    carrier: md.sealine_name || md.sealine || lastRecord?.carrier || ship?.carrier || "",
    status: delivered ? "DELIVERED" : md.status || ship?.status || "IN_TRANSIT",
    fromName: polLoc?.name || lastRecord?.pol_name || ship?.portOfLading || "",
    fromCountry: polLoc?.country || "",
    toName: podLoc?.name || lastRecord?.pod_name || ship?.portOfEntryShipTo || "",
    toCountry: podLoc?.country || "",
    departureDate: route.pol?.date || aisData.departure_port?.date || lastRecord?.pol_date || "",
    arrivalDate: route.pod?.date || aisData.discharge_port?.date || ship?.updatedETA || ship?.ETA || "",
    predictiveEta: route.pod?.predictive_eta || "",
    containerType: cont.size_type || cont.iso_code || lastRecord?.container_size_type || "",
    vesselName: aisData.vessel?.name || lastRecord?.vessel_names || ship?.vesselName || "",
    vesselImo: aisData.vessel?.imo ? String(aisData.vessel.imo) : "",
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
    events: sortedEvents.map((ev: any) => {
      const evLoc = ev.location ? byId(locations, ev.location) : null;
      const evVessel = ev.vessel ? byId(vessels, ev.vessel) : null;
      return {
        description: ev.description || ev.status || ev.event_code || "Event",
        date: ev.date,
        location: evLoc ? `${evLoc.name}${evLoc.country ? `, ${evLoc.country}` : ""}` : "",
        vessel: evVessel?.name || "",
        voyage: ev.voyage || "",
        actual: ev.actual === true,
      };
    }),
    appUrl,
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

  const lastRecord = (ship as any).shippingTrackingRecords?.[
    (ship as any).shippingTrackingRecords.length - 1
  ];
  const rawStatus = lastRecord?.raw_json?.data?.metadata?.status || (ship as any).status || "";
  const delivered = isDeliveredStatus(rawStatus);

  const appUrl = process.env.APP_URL || "http://localhost:1001";
  const data = buildShipmentEmailData(ship, appUrl, delivered);
  const { subject, html } = renderShipmentStatusEmail(data);
  const result = await sendMail({ to: recipients, subject, html });

  return { success: result.success, error: result.error, delivered };
}
