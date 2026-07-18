import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import EmailAutomation from "@/lib/models/EmailAutomation";
import VBshipping from "@/lib/models/VBshipping";
import { sendMail } from "@/lib/email/send";
import { renderShipmentStatusEmail } from "@/lib/email/templates/shipment-status";
import {
  buildShipmentEmailData,
  isDeliveredStatus,
  latestRawStatus,
} from "@/lib/email/shipment-status-sender";
import { publicAppUrl } from "@/lib/tracking-token";
import { ensureFreshTracking } from "@/lib/tracking-refresh";

/**
 * GET /api/cron/email-automations
 *
 * Runs hourly (vercel.json). For each ACTIVE automation:
 *  - Computes the current local time in the automation's timezone.
 *  - If we're inside the send window (sendTime .. sendTime+59min) and the
 *    last send was >= frequencyDays ago (with 2h tolerance), sends the
 *    shipment status email to all recipients.
 *  - If the shipment is DELIVERED: sends one final delivery notice and
 *    deactivates the automation. If that final send fails, the automation
 *    stays active so the notice is retried on the next hourly run instead
 *    of being lost.
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
    const appUrl = publicAppUrl(); // emails go to externals — never localhost

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

        const delivered = isDeliveredStatus(latestRawStatus(ship));

        // ── Delivered → one final notice, then deactivate ──
        if (delivered) {
          if (!auto.deliveredNoticeSent) {
            const data = buildShipmentEmailData(ship, appUrl, true);
            const { subject, html, text } = renderShipmentStatusEmail(data);
            const result = await sendMail({ to: auto.recipients, subject, html, text });
            if (!result.success) {
              // Keep the automation active so the final notice retries next hour
              errors.push(`${auto.containerNo} (final notice): ${result.error}`);
              continue;
            }
            sent++;
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
        const target = (hh || 0) * 60 + (mm || 0);
        const nowLocal = localMinutes(auto.timezone || "America/Toronto");
        const inWindow = nowLocal >= target && nowLocal < target + 60;
        if (!inWindow) continue;

        // ── Frequency check (2h tolerance so hourly drift never skips a day) ──
        const intervalMs = auto.frequencyDays * 86400000 - 2 * 3600000;
        if (auto.lastSentAt && Date.now() - new Date(auto.lastSentAt).getTime() < intervalMs) {
          continue;
        }

        // About to send → make sure the snapshot is rich & current.
        // (Only here, so hourly runs that send nothing never spend SeaRates quota.)
        const { refreshed } = await ensureFreshTracking(auto.containerNo);
        const freshShip = refreshed
          ? (await VBshipping.findOne(
              { containerNo: auto.containerNo },
              { driveDocuments: 0, shippingTrackingRecords: { $slice: -1 } }
            ).lean()) || ship
          : ship;

        const data = buildShipmentEmailData(freshShip, appUrl, false);
        const { subject, html, text } = renderShipmentStatusEmail(data);
        const result = await sendMail({ to: auto.recipients, subject, html, text });

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
