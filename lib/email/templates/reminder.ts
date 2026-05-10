/**
 * Premium HTML email template for daily reminder digests.
 * Table-based layout for email client compatibility.
 * Dark-mode safe with prefers-color-scheme media query.
 */

export interface ReminderEmailItem {
  title: string;
  comments?: string;
  vbNumber?: string;
  vbSerial?: string;
  vbShipment?: string;
  reminder: Date;
  status: string;
  link: string;
}

interface RenderInput {
  userName: string;
  items: ReminderEmailItem[];
  appUrl: string;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max).trimEnd() + "…";
}

function statusColor(status: string): { bg: string; text: string } {
  switch (status) {
    case "In Progress":
      return { bg: "#DBEAFE", text: "#1D4ED8" };
    default: // Open
      return { bg: "#FEF3C7", text: "#B45309" };
  }
}

export function renderReminderEmail(input: RenderInput): {
  subject: string;
  html: string;
  text: string;
} {
  const { userName, items, appUrl } = input;
  const firstName = userName.split(" ")[0] || "there";
  const today = formatDate(new Date());

  const subject = `🔔 ${items.length} reminder${items.length !== 1 ? "s" : ""} due today — VidaBuddies`;

  // ── Build item rows ──────────────────────────────────────
  const itemRows = items
    .map((item) => {
      const sc = statusColor(item.status);
      const comments = item.comments ? truncate(item.comments, 140) : "";
      const chips: string[] = [];
      if (item.vbNumber) chips.push(item.vbNumber);
      if (item.vbSerial) chips.push(item.vbSerial);
      if (item.vbShipment) chips.push(item.vbShipment);
      const chipsHtml = chips.length
        ? `<div style="margin-top:6px;">${chips.map((c) => `<span style="display:inline-block;background:#F1F5F9;color:#64748B;font-size:11px;padding:2px 8px;border-radius:4px;margin-right:4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${c}</span>`).join("")}</div>`
        : "";

      return `
        <tr>
          <td style="padding:16px 20px;border-bottom:1px solid #F1F5F9;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="8" valign="top" style="padding-top:4px;">
                  <div style="width:8px;height:8px;border-radius:50%;background:${sc.text};"></div>
                </td>
                <td style="padding-left:14px;" valign="top">
                  <div style="font-size:14px;font-weight:600;color:#0F172A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.4;">
                    ${item.title}
                  </div>
                  ${comments ? `<div style="font-size:13px;color:#64748B;margin-top:3px;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${comments}</div>` : ""}
                  <div style="margin-top:8px;">
                    <span style="display:inline-block;background:${sc.bg};color:${sc.text};font-size:11px;font-weight:700;padding:3px 10px;border-radius:6px;text-transform:uppercase;letter-spacing:0.5px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                      ${item.status}
                    </span>
                  </div>
                  ${chipsHtml}
                </td>
                <td width="80" align="right" valign="top" style="padding-top:2px;">
                  <a href="${appUrl}${item.link}" style="display:inline-block;background:#0F172A;color:#FFFFFF;font-size:12px;font-weight:600;padding:6px 14px;border-radius:6px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                    Open →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
    })
    .join("");

  // ── Full HTML ────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${subject}</title>
  <style>
    @media (prefers-color-scheme: dark) {
      .email-bg { background-color: #0F172A !important; }
      .card-bg { background-color: #1E293B !important; border-color: #334155 !important; }
      .text-dark { color: #F1F5F9 !important; }
      .text-muted { color: #94A3B8 !important; }
      .chip-bg { background-color: #334155 !important; color: #94A3B8 !important; }
      .row-border { border-color: #334155 !important; }
      .footer-text { color: #64748B !important; }
      .hero-bg { background-color: #1E293B !important; border-color: #334155 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#F8FAFC;-webkit-font-smoothing:antialiased;" class="email-bg">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F8FAFC;" class="email-bg">
    <tr>
      <td align="center" style="padding:24px 16px 40px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- Brand Bar -->
          <tr>
            <td style="background:#0F172A;padding:0 24px;height:56px;border-radius:12px 12px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:18px;font-weight:700;color:#FFFFFF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;letter-spacing:-0.3px;">
                    VidaBuddies
                  </td>
                  <td align="right" style="font-size:20px;color:#FFFFFF;">
                    🔔
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero Card -->
          <tr>
            <td style="background:#FFFFFF;padding:28px 24px 20px;border-left:1px solid #E2E8F0;border-right:1px solid #E2E8F0;" class="hero-bg">
              <div style="font-size:13px;color:#64748B;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin-bottom:6px;" class="text-muted">
                Hey ${firstName} 👋
              </div>
              <div style="font-size:22px;font-weight:700;color:#0F172A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.3;" class="text-dark">
                You have ${items.length} reminder${items.length !== 1 ? "s" : ""} due today
              </div>
              <div style="font-size:13px;color:#94A3B8;margin-top:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" class="text-muted">
                ${today}
              </div>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="background:#FFFFFF;padding:0 24px;border-left:1px solid #E2E8F0;border-right:1px solid #E2E8F0;" class="card-bg">
              <div style="border-top:1px solid #E2E8F0;" class="row-border"></div>
            </td>
          </tr>

          <!-- Items -->
          <tr>
            <td style="background:#FFFFFF;border-left:1px solid #E2E8F0;border-right:1px solid #E2E8F0;" class="card-bg">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${itemRows}
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="background:#FFFFFF;padding:24px 24px 28px;border-left:1px solid #E2E8F0;border-right:1px solid #E2E8F0;border-bottom:1px solid #E2E8F0;border-radius:0 0 12px 12px;text-align:center;" class="card-bg">
              <a href="${appUrl}/admin/active-actions"
                 style="display:inline-block;background:linear-gradient(135deg,#0F172A 0%,#1E293B 100%);color:#FFFFFF;font-size:14px;font-weight:600;padding:12px 32px;border-radius:8px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;letter-spacing:0.2px;">
                View all in Active Actions →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 24px 0;text-align:center;">
              <div style="font-size:12px;color:#94A3B8;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" class="footer-text">
                You're receiving this because you're a <strong>Super Admin</strong> in VidaBuddies.<br/>
                <a href="${appUrl}/admin/settings" style="color:#64748B;text-decoration:underline;">Manage in Settings</a>
              </div>
              <div style="font-size:11px;color:#CBD5E1;margin-top:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" class="footer-text">
                © ${new Date().getFullYear()} VidaBuddies • All rights reserved
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // ── Plain text fallback ──────────────────────────────────
  const textItems = items
    .map(
      (item, i) =>
        `${i + 1}. [${item.status}] ${item.title}${
          item.comments ? `\n   ${truncate(item.comments, 140)}` : ""
        }${item.vbNumber ? `\n   VB#: ${item.vbNumber}` : ""}${
          item.vbSerial ? ` | Serial: ${item.vbSerial}` : ""
        }${item.vbShipment ? ` | Shipment: ${item.vbShipment}` : ""}\n   → ${appUrl}${item.link}`
    )
    .join("\n\n");

  const text = `Hey ${firstName},

You have ${items.length} reminder${items.length !== 1 ? "s" : ""} due today (${today}).

${textItems}

────────────────────────
View all: ${appUrl}/admin/active-actions

You're receiving this because you're a Super Admin in VidaBuddies.
Manage: ${appUrl}/admin/settings`;

  return { subject, html, text };
}
