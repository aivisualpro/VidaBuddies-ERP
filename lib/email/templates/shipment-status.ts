/**
 * Shipment status email — a dark-themed HTML "screenshot" of the
 * Live Tracking panel: header, from→to, info cards, route segments,
 * event timeline and current position. Built with inline styles +
 * tables so it renders correctly in Gmail/Outlook/Apple Mail.
 */

export interface ShipmentStatusEmailData {
  containerNo: string;
  carrier?: string;
  status?: string;          // e.g. "IN_TRANSIT"
  fromName?: string;
  fromCountry?: string;
  toName?: string;
  toCountry?: string;
  departureDate?: string;
  arrivalDate?: string;
  predictiveEta?: string;
  containerType?: string;
  vesselName?: string;
  vesselImo?: string;
  vesselFlag?: string;
  etaDays?: number | null;
  currentLat?: number;
  currentLng?: number;
  positionUpdatedAt?: string;
  segments: { vessel?: string; from?: string; to?: string }[];
  events: {
    description?: string;
    date?: string;
    location?: string;
    vessel?: string;
    voyage?: string;
    actual?: boolean;
  }[];
  appUrl: string;
  delivered?: boolean;
}

const esc = (s: any) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

function fmtDate(s?: string): string {
  if (!s) return "—";
  const d = new Date(String(s).replace(" ", "T"));
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDateTime(s?: string): string {
  if (!s) return "—";
  const d = new Date(String(s).replace(" ", "T"));
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function infoCard(label: string, main: string, sub1?: string, sub2?: string): string {
  return `
  <td width="50%" style="padding:6px;">
    <div style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:14px;">
      <div style="font-size:10px;color:#71717a;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">${esc(label)}</div>
      <div style="font-size:15px;font-weight:700;color:#ffffff;">${esc(main || "—")}</div>
      ${sub1 ? `<div style="font-size:11px;color:#a1a1aa;margin-top:3px;">${esc(sub1)}</div>` : ""}
      ${sub2 ? `<div style="font-size:11px;color:#71717a;margin-top:3px;font-family:monospace;">${esc(sub2)}</div>` : ""}
    </div>
  </td>`;
}

export function renderShipmentStatusEmail(d: ShipmentStatusEmailData): { subject: string; html: string } {
  const statusLabel = (d.status || "IN TRANSIT").replace(/_/g, " ").toUpperCase();
  const delivered = !!d.delivered;
  const statusColor = delivered ? "#34d399" : "#60a5fa";
  const statusBg = delivered ? "rgba(16,185,129,0.12)" : "rgba(59,130,246,0.12)";

  const subject = delivered
    ? `✅ Delivered — Container ${d.containerNo} (${d.fromName || ""} → ${d.toName || ""})`
    : `🚢 Shipment Update — ${d.containerNo} · ${d.fromName || "?"} → ${d.toName || "?"}${
        d.etaDays != null && d.etaDays > 0 ? ` · ${d.etaDays} days to arrival` : ""
      }`;

  const segmentsHtml = d.segments.length
    ? `
    <div style="font-size:10px;color:#71717a;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin:20px 0 8px;">Route Segments</div>
    ${d.segments
      .map(
        (s) => `
      <div style="background:#141417;border:1px solid #27272a;border-radius:10px;padding:10px 14px;margin-bottom:8px;">
        <div style="font-size:11px;color:#e4e4e7;font-weight:600;">⛴️ ${esc(s.vessel || "Unknown Vessel")}</div>
        <div style="font-size:11px;margin-top:4px;">
          <span style="color:#60a5fa;font-weight:600;">${esc(s.from || "?")}</span>
          <span style="color:#52525b;"> &nbsp;›&nbsp; </span>
          <span style="color:#34d399;font-weight:600;">${esc(s.to || "?")}</span>
        </div>
      </div>`
      )
      .join("")}`
    : "";

  const eventsHtml = d.events.length
    ? `
    <div style="font-size:10px;color:#71717a;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin:20px 0 8px;">Event Timeline</div>
    ${d.events
      .map((ev) => {
        const dim = ev.actual === false;
        return `
      <div style="background:${dim ? "#131316" : "#18181b"};border:1px ${dim ? "dashed" : "solid"} #27272a;border-radius:10px;padding:10px 14px;margin-bottom:6px;${dim ? "opacity:0.75;" : ""}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:12px;font-weight:700;color:${dim ? "#71717a" : "#ffffff"};">${esc(ev.description || "Event")}</td>
          <td align="right" style="font-size:10px;color:${dim ? "#52525b" : "#d4d4d8"};font-family:monospace;white-space:nowrap;">${fmtDateTime(ev.date)}</td>
        </tr></table>
        <div style="font-size:10px;color:#a1a1aa;margin-top:4px;">
          ${ev.location ? `📍 ${esc(ev.location)}` : ""}
          ${ev.vessel ? ` &nbsp; ⛴️ ${esc(ev.vessel)}` : ""}
          ${ev.voyage ? ` &nbsp; 🧭 ${esc(ev.voyage)}` : ""}
          ${dim ? ` &nbsp; <span style="color:#f59e0b;font-weight:700;font-size:9px;">ESTIMATED</span>` : ""}
        </div>
      </div>`;
      })
      .join("")}`
    : "";

  const positionHtml =
    d.currentLat != null && d.currentLng != null
      ? `
    <div style="background:#141417;border:1px solid #27272a;border-radius:10px;padding:12px 14px;margin-top:16px;">
      <div style="font-size:11px;color:#e4e4e7;">🧭 <b>Current Position:</b> <span style="font-family:monospace;">${d.currentLat.toFixed(4)}°, ${d.currentLng.toFixed(4)}°</span></div>
      ${d.positionUpdatedAt ? `<div style="font-size:10px;color:#71717a;margin-top:3px;">Updated: ${fmtDateTime(d.positionUpdatedAt)}</div>` : ""}
    </div>`
      : "";

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0a0a0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0b;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#101013,#17171b);border:1px solid #27272a;border-radius:16px 16px 0 0;padding:22px 26px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td>
              <div style="font-size:20px;font-weight:800;color:#ffffff;font-family:monospace;letter-spacing:0.5px;">📦 ${esc(d.containerNo)}</div>
              <div style="margin-top:6px;">
                ${d.carrier ? `<span style="font-size:12px;color:#a1a1aa;">${esc(d.carrier)}</span>&nbsp;&nbsp;` : ""}
                <span style="display:inline-block;font-size:10px;font-weight:800;letter-spacing:1px;color:${statusColor};background:${statusBg};border:1px solid ${statusColor}44;border-radius:999px;padding:3px 10px;">${esc(statusLabel)}</span>
              </div>
            </td>
            ${
              d.etaDays != null && d.etaDays > 0 && !delivered
                ? `<td align="right" valign="top"><div style="display:inline-block;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);border-radius:999px;padding:5px 12px;font-size:11px;color:#fbbf24;font-weight:700;">⏱ ${d.etaDays} days to arrival</div></td>`
                : ""
            }
          </tr></table>
          <div style="margin-top:14px;font-size:12px;color:#a1a1aa;">
            <span style="color:#60a5fa;">●</span> From <b style="color:#e4e4e7;">${esc(d.fromName || "?")}${d.fromCountry ? `, ${esc(d.fromCountry)}` : ""}</b>
            &nbsp;›&nbsp;
            <span style="color:#34d399;">●</span> To <b style="color:#e4e4e7;">${esc(d.toName || "?")}${d.toCountry ? `, ${esc(d.toCountry)}` : ""}</b>
          </div>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#0f0f11;border:1px solid #27272a;border-top:none;padding:18px 20px;">

          <!-- Info cards 2x2 -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              ${infoCard("⚓ Departure", d.fromName || "", d.fromCountry, fmtDate(d.departureDate))}
              ${infoCard("📍 Arrival", d.toName || "", d.toCountry, fmtDate(d.arrivalDate) + (d.predictiveEta ? ` · AI ETA ${fmtDate(d.predictiveEta)}` : ""))}
            </tr>
            <tr>
              ${infoCard("📦 Container", d.containerNo, d.containerType, d.carrier)}
              ${infoCard("🚢 Vessel", d.vesselName || "—", d.vesselImo ? `IMO: ${d.vesselImo}` : undefined, d.vesselFlag ? `Flag: ${d.vesselFlag}` : undefined)}
            </tr>
          </table>

          ${segmentsHtml}
          ${eventsHtml}
          ${positionHtml}

          <!-- CTA -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;">
            <tr><td align="center">
              <a href="${esc(d.appUrl)}/admin/live-shipments" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:13px;font-weight:700;text-decoration:none;border-radius:10px;padding:11px 28px;">🗺️ &nbsp;View Live Map &amp; Tracking</a>
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#0c0c0e;border:1px solid #27272a;border-top:none;border-radius:0 0 16px 16px;padding:14px 24px;">
          <div style="font-size:10px;color:#52525b;text-align:center;">
            Automated shipment update from <b style="color:#71717a;">VidaBuddies ERP</b>.
            ${delivered ? "This shipment has been delivered — this automation is now complete and no further emails will be sent." : "You are receiving this because an email automation was set up for this container. Updates stop automatically on delivery."}
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
