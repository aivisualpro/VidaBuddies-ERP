/**
 * Shipment status email — a premium light-themed HTML "snapshot" of the
 * shipment: brand header, journey progress bar, ETA countdown,
 * next-milestone callout, info cards, route segments, visual event
 * timeline and current position. Built with inline styles + tables so it
 * renders correctly in Gmail / Outlook / Apple Mail.
 *
 * The CTA links to the SECURE PUBLIC tracker (/track/{container}?t=token)
 * so external recipients can open it without any login.
 * Also returns a plain-text version for better deliverability.
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
  /** Secure public tracking link for external recipients (preferred CTA target) */
  trackUrl?: string;
  delivered?: boolean;
}

/** Max timeline events rendered — keeps the email under Gmail's ~102KB clipping limit */
const MAX_EVENTS = 12;

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

function parseDate(s?: string): Date | null {
  if (!s) return null;
  const d = new Date(String(s).replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d;
}

function fmtDate(s?: string): string {
  const d = parseDate(s);
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDateTime(s?: string): string {
  const d = parseDate(s);
  if (!d) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function infoCard(label: string, main: string, sub1?: string, sub2?: string): string {
  return `
  <td width="50%" style="padding:6px;vertical-align:top;">
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;">
      <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">${esc(label)}</div>
      <div style="font-size:15px;font-weight:700;color:#0f172a;">${esc(main || "—")}</div>
      ${sub1 ? `<div style="font-size:11px;color:#64748b;margin-top:3px;">${esc(sub1)}</div>` : ""}
      ${sub2 ? `<div style="font-size:11px;color:#94a3b8;margin-top:3px;font-family:monospace;">${esc(sub2)}</div>` : ""}
    </div>
  </td>`;
}

/** 0–100 journey progress: time-based when dates exist, else event-based */
function journeyProgress(d: ShipmentStatusEmailData): number | null {
  if (d.delivered) return 100;
  const dep = parseDate(d.departureDate);
  const arr = parseDate(d.predictiveEta) || parseDate(d.arrivalDate);
  const now = Date.now();
  if (dep && arr && arr.getTime() > dep.getTime()) {
    const pct = ((now - dep.getTime()) / (arr.getTime() - dep.getTime())) * 100;
    return Math.max(2, Math.min(98, Math.round(pct)));
  }
  if (d.events.length > 0) {
    const done = d.events.filter((e) => e.actual !== false).length;
    return Math.max(2, Math.min(98, Math.round((done / d.events.length) * 100)));
  }
  return null;
}

/** Earliest upcoming (estimated) event — the "next milestone" */
function nextMilestone(d: ShipmentStatusEmailData) {
  if (d.delivered) return null;
  const upcoming = d.events
    .filter((e) => e.actual === false && parseDate(e.date))
    .sort((a, b) => parseDate(a.date)!.getTime() - parseDate(b.date)!.getTime());
  return upcoming[0] || null;
}

export function renderShipmentStatusEmail(
  d: ShipmentStatusEmailData
): { subject: string; html: string; text: string } {
  const statusLabel = (d.status || "IN TRANSIT").replace(/_/g, " ").toUpperCase();
  const delivered = !!d.delivered;
  const statusColor = delivered ? "#047857" : "#1d4ed8";
  const statusBg = delivered ? "#d1fae5" : "#dbeafe";
  const statusBorder = delivered ? "#6ee7b7" : "#93c5fd";

  const progress = journeyProgress(d);
  const milestone = nextMilestone(d);

  const dep = parseDate(d.departureDate);
  const daysAtSea = dep ? Math.max(0, Math.floor((Date.now() - dep.getTime()) / 86400000)) : null;
  const etaLabel = d.predictiveEta || d.arrivalDate;

  // External recipients get the secure public tracker; fall back to the app
  const ctaUrl = d.trackUrl || `${d.appUrl}/admin/live-shipments`;

  const route = `${d.fromName || "?"} → ${d.toName || "?"}`;
  const subject = delivered
    ? `✅ Delivered — ${d.containerNo} · ${route}`
    : `🚢 ${d.containerNo} · ${route}${progress != null ? ` · ${progress}% complete` : ""}${
        d.etaDays != null && d.etaDays > 0 ? ` · ETA ${fmtDate(etaLabel)} (${d.etaDays}d)` : ""
      }`;

  const preheader = delivered
    ? `Your container ${d.containerNo} has been delivered at ${d.toName || "destination"}. Final update.`
    : `${statusLabel} · ${route}${progress != null ? ` · ${progress}% of journey complete` : ""}${
        d.etaDays != null && d.etaDays > 0 ? ` · ${d.etaDays} days to arrival` : ""
      }`;

  // ── Journey progress bar (table-based so it renders everywhere) ──
  const progressHtml =
    progress != null
      ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
      <tr>
        <td style="font-size:11px;font-weight:700;color:#2563eb;padding-bottom:6px;">● ${esc(d.fromName || "Origin")}</td>
        <td align="center" style="font-size:11px;font-weight:800;color:${delivered ? "#059669" : "#d97706"};padding-bottom:6px;">${delivered ? "DELIVERED" : `${progress}% complete`}</td>
        <td align="right" style="font-size:11px;font-weight:700;color:#059669;padding-bottom:6px;">${esc(d.toName || "Destination")} ●</td>
      </tr>
      <tr>
        <td colspan="3">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
            <tr>
              <td width="${progress}%" height="8" style="background:${delivered ? "#10b981" : "#2563eb"};border-radius:4px 0 0 4px;font-size:0;line-height:0;">&nbsp;</td>
              <td height="8" style="background:#e2e8f0;border-radius:0 4px 4px 0;font-size:0;line-height:0;">&nbsp;</td>
            </tr>
          </table>
        </td>
      </tr>
      ${
        !delivered && (daysAtSea != null || (d.etaDays != null && d.etaDays > 0))
          ? `<tr><td colspan="3" align="center" style="font-size:10px;color:#94a3b8;padding-top:7px;">
              ${daysAtSea != null ? `⛵ ${daysAtSea} day${daysAtSea === 1 ? "" : "s"} at sea` : ""}
              ${daysAtSea != null && d.etaDays != null && d.etaDays > 0 ? `&nbsp;·&nbsp;` : ""}
              ${d.etaDays != null && d.etaDays > 0 ? `⏱ ${d.etaDays} day${d.etaDays === 1 ? "" : "s"} to arrival` : ""}
            </td></tr>`
          : ""
      }
    </table>`
      : "";

  // ── Next milestone callout ──
  const milestoneHtml = milestone
    ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
      <tr><td style="background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:12px 16px;">
        <div style="font-size:9px;color:#d97706;text-transform:uppercase;letter-spacing:1.5px;font-weight:800;margin-bottom:4px;">⏳ Next Milestone</div>
        <div style="font-size:13px;font-weight:700;color:#92400e;">${esc(milestone.description || "Upcoming event")}</div>
        <div style="font-size:11px;color:#a16207;margin-top:3px;">
          ${milestone.location ? `📍 ${esc(milestone.location)} &nbsp;·&nbsp; ` : ""}Est. ${fmtDateTime(milestone.date)}
        </div>
      </td></tr>
    </table>`
    : "";

  const segmentsHtml = d.segments.length
    ? `
    <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin:20px 0 8px;">Route Segments</div>
    ${d.segments
      .map(
        (s) => `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px;margin-bottom:8px;">
        <div style="font-size:11px;color:#334155;font-weight:600;">⛴️ ${esc(s.vessel || "Unknown Vessel")}</div>
        <div style="font-size:11px;margin-top:4px;">
          <span style="color:#2563eb;font-weight:600;">${esc(s.from || "?")}</span>
          <span style="color:#cbd5e1;"> &nbsp;›&nbsp; </span>
          <span style="color:#059669;font-weight:600;">${esc(s.to || "?")}</span>
        </div>
      </div>`
      )
      .join("")}`
    : "";

  // ── Event timeline (status dots + capped for Gmail clipping) ──
  const shownEvents = d.events.length > MAX_EVENTS ? d.events.slice(-MAX_EVENTS) : d.events;
  const hiddenCount = d.events.length - shownEvents.length;

  const eventsHtml = shownEvents.length
    ? `
    <div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin:20px 0 8px;">Event Timeline</div>
    ${
      hiddenCount > 0
        ? `<div style="font-size:10px;color:#94a3b8;margin-bottom:8px;">…${hiddenCount} earlier event${hiddenCount === 1 ? "" : "s"} — see the full history in the live tracker</div>`
        : ""
    }
    ${shownEvents
      .map((ev) => {
        const dim = ev.actual === false;
        const dot = dim
          ? `<div style="width:9px;height:9px;border-radius:50%;border:2px solid #f59e0b;"></div>`
          : `<div style="width:11px;height:11px;border-radius:50%;background:#10b981;"></div>`;
        return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:6px;">
        <tr>
          <td width="22" valign="top" style="padding-top:14px;">${dot}</td>
          <td>
            <div style="background:${dim ? "#fcfcfd" : "#ffffff"};border:1px ${dim ? "dashed #cbd5e1" : "solid #e2e8f0"};border-radius:10px;padding:10px 14px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td style="font-size:12px;font-weight:700;color:${dim ? "#64748b" : "#0f172a"};">${esc(ev.description || "Event")}</td>
                <td align="right" style="font-size:10px;color:${dim ? "#94a3b8" : "#475569"};font-family:monospace;white-space:nowrap;">${fmtDateTime(ev.date)}</td>
              </tr></table>
              <div style="font-size:10px;color:#64748b;margin-top:4px;">
                ${ev.location ? `📍 ${esc(ev.location)}` : ""}
                ${ev.vessel ? ` &nbsp; ⛴️ ${esc(ev.vessel)}` : ""}
                ${ev.voyage ? ` &nbsp; 🧭 ${esc(ev.voyage)}` : ""}
                ${dim ? ` &nbsp; <span style="color:#d97706;font-weight:700;font-size:9px;">ESTIMATED</span>` : ""}
              </div>
            </div>
          </td>
        </tr>
      </table>`;
      })
      .join("")}`
    : "";

  const mapsLink =
    d.currentLat != null && d.currentLng != null
      ? `https://www.google.com/maps?q=${d.currentLat.toFixed(5)},${d.currentLng.toFixed(5)}`
      : "";

  const positionHtml =
    d.currentLat != null && d.currentLng != null
      ? `
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin-top:16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:11px;color:#334155;">🧭 <b>Current Position:</b> <span style="font-family:monospace;">${d.currentLat.toFixed(4)}°, ${d.currentLng.toFixed(4)}°</span></td>
        <td align="right"><a href="${esc(mapsLink)}" style="font-size:10px;color:#2563eb;text-decoration:none;font-weight:700;">Open in Google Maps ↗</a></td>
      </tr></table>
      ${d.positionUpdatedAt ? `<div style="font-size:10px;color:#94a3b8;margin-top:3px;">Updated: ${fmtDateTime(d.positionUpdatedAt)}</div>` : ""}
    </div>`
      : "";

  const deliveredBanner = delivered
    ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
      <tr><td align="center" style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:12px;padding:16px;">
        <div style="font-size:22px;">🎉</div>
        <div style="font-size:15px;font-weight:800;color:#047857;margin-top:4px;">Shipment Delivered</div>
        <div style="font-size:11px;color:#475569;margin-top:4px;">This container has completed its journey. This is the final automated update.</div>
      </td></tr>
    </table>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <!-- Preheader (hidden preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${esc(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;">

        <!-- Brand strip -->
        <tr><td style="padding:0 4px 10px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="font-size:11px;font-weight:800;letter-spacing:2px;color:#475569;">🌊 VIDABUDDIES <span style="color:#2563eb;">ERP</span></td>
            <td align="right" style="font-size:9px;letter-spacing:1.5px;color:#94a3b8;text-transform:uppercase;">Live Shipment Tracking</td>
          </tr></table>
        </td></tr>

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#ffffff,#f8fafc);border:1px solid #e2e8f0;border-radius:16px 16px 0 0;padding:22px 26px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td>
              <div style="font-size:20px;font-weight:800;color:#0f172a;font-family:monospace;letter-spacing:0.5px;">📦 ${esc(d.containerNo)}</div>
              <div style="margin-top:6px;">
                ${d.carrier ? `<span style="font-size:12px;color:#64748b;">${esc(d.carrier)}</span>&nbsp;&nbsp;` : ""}
                <span style="display:inline-block;font-size:10px;font-weight:800;letter-spacing:1px;color:${statusColor};background:${statusBg};border:1px solid ${statusBorder};border-radius:999px;padding:3px 10px;">${esc(statusLabel)}</span>
              </div>
            </td>
            ${
              d.etaDays != null && d.etaDays > 0 && !delivered
                ? `<td align="right" valign="top"><div style="display:inline-block;background:#fef3c7;border:1px solid #fcd34d;border-radius:999px;padding:5px 12px;font-size:11px;color:#b45309;font-weight:700;">⏱ ${d.etaDays} day${d.etaDays === 1 ? "" : "s"} to arrival</div></td>`
                : ""
            }
          </tr></table>
          ${progressHtml}
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#ffffff;border:1px solid #e2e8f0;border-top:none;padding:18px 20px;">

          ${deliveredBanner}
          ${milestoneHtml}

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
              <a href="${esc(ctaUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;font-size:13px;font-weight:700;text-decoration:none;border-radius:10px;padding:11px 28px;">🗺️ &nbsp;View Live Map &amp; Tracking</a>
              <div style="font-size:10px;color:#94a3b8;margin-top:8px;">Secure link — opens your shipment&#39;s live tracker, no login needed.</div>
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;padding:14px 24px;">
          <div style="font-size:10px;color:#94a3b8;text-align:center;line-height:1.6;">
            Automated shipment update from <b style="color:#64748b;">VidaBuddies ERP</b>.
            ${delivered ? "This shipment has been delivered — this automation is now complete and no further emails will be sent." : "You are receiving this because an email automation was set up for this container. Updates stop automatically on delivery."}
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  // ── Plain-text version (deliverability + accessibility) ──
  const textLines: string[] = [
    `VIDABUDDIES ERP — SHIPMENT ${delivered ? "DELIVERED" : "UPDATE"}`,
    ``,
    `Container: ${d.containerNo}${d.containerType ? ` (${d.containerType})` : ""}`,
    `Carrier:   ${d.carrier || "—"}`,
    `Status:    ${statusLabel}`,
    `Route:     ${d.fromName || "?"}${d.fromCountry ? `, ${d.fromCountry}` : ""} -> ${d.toName || "?"}${d.toCountry ? `, ${d.toCountry}` : ""}`,
    `Departed:  ${fmtDate(d.departureDate)}`,
    `Arrival:   ${fmtDate(d.arrivalDate)}${d.predictiveEta ? ` (AI ETA ${fmtDate(d.predictiveEta)})` : ""}`,
  ];
  if (progress != null && !delivered) {
    textLines.push(`Progress:  ${progress}% of journey complete${d.etaDays != null && d.etaDays > 0 ? ` — ${d.etaDays} day(s) to arrival` : ""}`);
  }
  if (d.vesselName) textLines.push(`Vessel:    ${d.vesselName}${d.vesselImo ? ` (IMO ${d.vesselImo})` : ""}`);
  if (milestone) {
    textLines.push(``, `NEXT MILESTONE: ${milestone.description || "Upcoming event"}${milestone.location ? ` at ${milestone.location}` : ""} — est. ${fmtDateTime(milestone.date)}`);
  }
  if (d.currentLat != null && d.currentLng != null) {
    textLines.push(``, `Current position: ${d.currentLat.toFixed(4)}, ${d.currentLng.toFixed(4)} (${mapsLink})`);
  }
  if (shownEvents.length) {
    textLines.push(``, `TIMELINE:`);
    for (const ev of shownEvents) {
      textLines.push(`  ${ev.actual === false ? "[est]" : "[ok] "} ${fmtDateTime(ev.date)} — ${ev.description || "Event"}${ev.location ? ` @ ${ev.location}` : ""}`);
    }
  }
  textLines.push(``, `Live map & tracking (secure link): ${ctaUrl}`);

  return { subject, html, text: textLines.join("\n") };
}
