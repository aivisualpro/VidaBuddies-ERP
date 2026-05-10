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

function statusPill(status: string): { bg: string; text: string; darkBg: string; darkText: string } {
  switch (status) {
    case "In Progress":
      return { bg: "#EFF6FF", text: "#1D4ED8", darkBg: "#1E3A5F", darkText: "#93C5FD" };
    default: // Open
      return { bg: "#FFFBEB", text: "#B45309", darkBg: "#4A3728", darkText: "#FCD34D" };
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
      const sc = statusPill(item.status);
      const comments = item.comments || "";
      const chips: string[] = [];
      if (item.vbNumber) chips.push(item.vbNumber);
      if (item.vbSerial) chips.push(item.vbSerial);
      if (item.vbShipment) chips.push(item.vbShipment);
      const chipsHtml = chips.length
        ? `<div style="margin-top:8px;">${chips.map((c) => `<span class="chip" style="display:inline-block;background:#F1F5F9;color:#475569;font-size:11px;padding:3px 10px;border-radius:6px;margin-right:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;border:1px solid #E2E8F0;">${c}</span>`).join("")}</div>`
        : "";

      return `
        <tr>
          <td class="item-border" style="padding:20px 24px;border-bottom:1px solid #F1F5F9;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td valign="top" style="padding-right:16px;">
                  <!-- Status dot -->
                  <div style="width:10px;height:10px;border-radius:50%;background:${sc.text};margin-top:6px;"></div>
                </td>
                <td style="width:100%;" valign="top">
                  <!-- Title -->
                  <div class="item-title" style="font-size:15px;font-weight:700;color:#1E293B;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.4;">
                    ${item.title}
                  </div>
                  <!-- Comments -->
                  ${comments ? `<div class="item-comments" style="font-size:13px;color:#475569;margin-top:6px;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${comments}</div>` : ""}
                  <!-- Status pill -->
                  <div style="margin-top:10px;">
                    <span style="display:inline-block;background:${sc.bg};color:${sc.text};font-size:11px;font-weight:700;padding:4px 12px;border-radius:6px;text-transform:uppercase;letter-spacing:0.5px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;border:1px solid ${sc.text}20;">
                      ${item.status}
                    </span>
                  </div>
                  <!-- Chips -->
                  ${chipsHtml}
                </td>
                <td width="90" align="right" valign="top" style="padding-top:4px;">
                  <a href="${appUrl}${item.link}" style="display:inline-block;background:#0F172A;color:#FFFFFF;font-size:12px;font-weight:700;padding:8px 16px;border-radius:8px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;letter-spacing:0.3px;">
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
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset */
    body, table, td { margin: 0; padding: 0; }
    img { border: 0; display: block; }
    
    /* Dark mode overrides */
    @media (prefers-color-scheme: dark) {
      .email-wrapper { background-color: #0B1120 !important; }
      .card-outer { background-color: #111827 !important; border-color: #1F2937 !important; }
      .brand-bar { background-color: #111827 !important; }
      .hero-greeting { color: #94A3B8 !important; }
      .hero-headline { color: #F8FAFC !important; }
      .hero-date { color: #64748B !important; }
      .item-title { color: #F1F5F9 !important; }
      .item-comments { color: #94A3B8 !important; }
      .item-border { border-color: #1F2937 !important; }
      .chip { background-color: #1E293B !important; color: #94A3B8 !important; border-color: #334155 !important; }
      .cta-button { background: #3B82F6 !important; }
      .footer-text { color: #64748B !important; }
      .footer-link { color: #94A3B8 !important; }
      .divider { border-color: #1F2937 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#F1F5F9;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F1F5F9;" class="email-wrapper">
    <tr>
      <td align="center" style="padding:32px 16px 48px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- ══════════ Brand Bar ══════════ -->
          <tr>
            <td class="brand-bar" style="background:#0F172A;padding:0 28px;height:56px;border-radius:16px 16px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:20px;font-weight:800;color:#FFFFFF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;letter-spacing:-0.5px;">
                    VidaBuddies
                  </td>
                  <td align="right" style="font-size:22px;">
                    🔔
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ══════════ Hero Card ══════════ -->
          <tr>
            <td class="card-outer" style="background:#FFFFFF;padding:32px 28px 24px;border-left:1px solid #E2E8F0;border-right:1px solid #E2E8F0;">
              <div class="hero-greeting" style="font-size:14px;color:#64748B;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin-bottom:8px;">
                Hey ${firstName} 👋
              </div>
              <div class="hero-headline" style="font-size:24px;font-weight:800;color:#0F172A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.3;letter-spacing:-0.3px;">
                You have ${items.length} reminder${items.length !== 1 ? "s" : ""} due today
              </div>
              <div class="hero-date" style="font-size:13px;color:#94A3B8;margin-top:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                ${today}
              </div>
            </td>
          </tr>

          <!-- ══════════ Divider ══════════ -->
          <tr>
            <td class="card-outer" style="background:#FFFFFF;padding:0 28px;border-left:1px solid #E2E8F0;border-right:1px solid #E2E8F0;">
              <div class="divider" style="border-top:2px solid #F1F5F9;"></div>
            </td>
          </tr>

          <!-- ══════════ Items ══════════ -->
          <tr>
            <td class="card-outer" style="background:#FFFFFF;border-left:1px solid #E2E8F0;border-right:1px solid #E2E8F0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${itemRows}
              </table>
            </td>
          </tr>

          <!-- ══════════ CTA Button ══════════ -->
          <tr>
            <td class="card-outer" style="background:#FFFFFF;padding:28px 28px 32px;border-left:1px solid #E2E8F0;border-right:1px solid #E2E8F0;border-bottom:1px solid #E2E8F0;border-radius:0 0 16px 16px;text-align:center;">
              <a href="${appUrl}/admin/active-actions"
                 class="cta-button"
                 style="display:inline-block;background:#0F172A;color:#FFFFFF;font-size:14px;font-weight:700;padding:14px 36px;border-radius:10px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;letter-spacing:0.3px;">
                View all in Active Actions →
              </a>
            </td>
          </tr>

          <!-- ══════════ Footer ══════════ -->
          <tr>
            <td style="padding:28px 28px 0;text-align:center;">
              <div class="footer-text" style="font-size:12px;color:#64748B;line-height:1.7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                You're receiving this because you're a <strong style="color:#475569;">Super Admin</strong> in VidaBuddies.<br/>
                <a href="${appUrl}/admin/settings" class="footer-link" style="color:#475569;text-decoration:underline;">Manage in Settings</a>
              </div>
              <div class="footer-text" style="font-size:11px;color:#94A3B8;margin-top:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
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
