import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import EmailAutomation from "@/lib/models/EmailAutomation";
import VBshipping from "@/lib/models/VBshipping";
import { sendMail } from "@/lib/email/send";
import {
  renderShipmentStatusEmail,
  type ShipmentStatusEmailData,
} from "@/lib/email/templates/shipment-status";

/**
 * GET /api/cron/email-automations
 *
 * Runs hourly (vercel.json). For each ACTIVE automation:
 *  - Computes the current local time in the automation's timezone.
 *  - If we're inside the send window (sendTime .. sendTime+59min) and the
 *    last send was >= frequencyDays ago (with 2h tolerance), sends the
 *    shipment status email to all recipients.
 *  - If the shipment is DELIVERED: sends one final delivery notice and
 *    deactivates the automation.
 *
 * Auth: x-cron-secret header OR Vercel cron Authorization bearer.
 */

/** Minutes since midnight in a given IANA timezone */
function localMinutes(tz: string, date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const h = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const m = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
  return (h === 24 ? 0 : h) * 60 + m;
}

function isDeliveredStatus(raw?: string): boolean {
  const s = (raw || "").toUpperCase();
  return s.includes("DELIVER") || s.includes("ARRIV");
}

const byId = (arr: any[], id: string) => (arr || []).find((x: any) => x?.id === id);

/** Build email data from a VBshipping record + its latest raw_json (SeaRates) */
function buildEmailData(ship: any, appUrl: string, delivered: boolean): ShipmentStatusEmailData {
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
    carrier: md.sealine_name || md.sealine || lastRecord?.carrier || "",
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

export async function GET(req: NextRequest) {
  try {
    // Auth: custom header or Vercel cron bearer
    const secret = req.headers.get("x-cron-secret");
    const bearer = req.headers.get("authorization");
    const ok =
      secret === process.env.CRON_SECRET ||
      bearer === `Bearer ${process.env.CRON_SECRET}`;
    if (!ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const appUrl = process.env.APP_URL || "http://localhost:1001";

    const automations = await EmailAutomation.find({ active: true }).lean();
    if (automations.length === 0) {
      return NextResponse.json({ checked: 0, sent: 0 });
    }

    // Fetch each container's shipment once (last tracking record only)
    const containerNos = [...new Set(automations.map((a: any) => a.containerNo))];
    const ships = await VBshipping.find(
      { containerNo: { $in: containerNos } },
      { driveDocuments: 0, shippingTrackingRecords: { $slice: -1 } }
    ).lean();
    const shipMap = new Map<string, any>();
    for (const s of ships) if (s.containerNo) shipMap.set(s.containerNo, s);

    let sent = 0;
    let deactivated = 0;
    const errors: string[] = [];

    for (const auto of automations as any[]) {
      try {
        const ship = shipMap.get(auto.containerNo);
        if (!ship) continue;

        const lastRecord = ship.shippingTrackingRecords?.[ship.shippingTrackingRecords.length - 1];
        const rawStatus = lastRecord?.raw_json?.data?.metadata?.status || ship.status || "";
        const delivered = isDeliveredStatus(rawStatus);

        // ── Delivered → one final notice, then deactivate ──
        if (delivered) {
          if (!auto.deliveredNoticeSent) {
            const data = buildEmailData(ship, appUrl, true);
            const { subject, html } = renderShipmentStatusEmail(data);
            const result = await sendMail({ to: auto.recipients, subject, html });
            if (result.success) sent++;
          }
          await EmailAutomation.updateOne(
            { _id: auto._id },
            { $set: { active: false, deliveredNoticeSent: true, lastSentAt: new Date() } }
          );
          deactivated++;
          continue;
        }

        // ── Send-window check (cron runs hourly) ──
        const [hh, mm] = String(auto.sendTime || "09:00").split(":").map(Number);
        const target = hh * 60 + mm;
        const nowLocal = localMinutes(auto.timezone || "America/Toronto");
        const inWindow = nowLocal >= target && nowLocal < target + 60;
        if (!inWindow) continue;

        // ── Frequency check (2h tolerance so hourly drift never skips a day) ──
        const intervalMs = auto.frequencyDays * 86400000 - 2 * 3600000;
        if (auto.lastSentAt && Date.now() - new Date(auto.lastSentAt).getTime() < intervalMs) {
          continue;
        }

        const data = buildEmailData(ship, appUrl, false);
        const { subject, html } = renderShipmentStatusEmail(data);
        const result = await sendMail({ to: auto.recipients, subject, html });

        if (result.success) {
          sent++;
          await EmailAutomation.updateOne(
            { _id: auto._id },
            { $set: { lastSentAt: new Date() } }
          );
        } else {
          errors.push(`${auto.containerNo}: ${result.error}`);
        }
      } catch (e: any) {
        errors.push(`${auto.containerNo}: ${e.message}`);
      }
    }

    return NextResponse.json({
      checked: automations.length,
      sent,
      deactivated,
      errors: errors.length ? errors : undefined,
    });
  } catch (e: any) {
    console.error("[cron/email-automations] Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
