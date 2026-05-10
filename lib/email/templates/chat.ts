/**
 * Premium HTML email template for chat notifications.
 * Modeled after the reminder template — dark-mode safe,
 * table-based layout for email client compatibility.
 */

export interface ChatEmailInput {
  recipientName: string;
  senderName: string;
  conversationName: string;
  messageSnippet: string;
  isMention: boolean;
  refs?: { kind: string; display: string }[];
  conversationId: string;
  appUrl: string;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max).trimEnd() + "…";
}

const REF_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  VBNumber: { bg: "#EEF2FF", text: "#4338CA", border: "#C7D2FE" },
  VBSerialNumber: { bg: "#ECFDF5", text: "#047857", border: "#A7F3D0" },
  VBShipmentNumber: { bg: "#F5F3FF", text: "#7C3AED", border: "#DDD6FE" },
};

export function renderChatEmail(input: ChatEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    recipientName,
    senderName,
    conversationName,
    messageSnippet,
    isMention,
    refs = [],
    conversationId,
    appUrl,
  } = input;

  const firstName = recipientName.split(" ")[0] || "there";
  const emoji = isMention ? "💬" : "✉️";
  const actionVerb = isMention ? "mentioned you" : "sent you a message";

  const subject = `${emoji} ${senderName} ${actionVerb} — VidaBuddies`;

  // Build ref chips
  const chipsHtml = refs.length
    ? `<div style="margin-top:12px;">${refs
        .map((r) => {
          const c = REF_COLORS[r.kind] || REF_COLORS.VBNumber;
          return `<span style="display:inline-block;background:${c.bg};color:${c.text};font-size:11px;font-weight:700;padding:3px 10px;border-radius:6px;margin-right:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;border:1px solid ${c.border};">#${r.display}</span>`;
        })
        .join("")}</div>`
    : "";

  const chatUrl = `${appUrl}/admin/chat?conv=${conversationId}`;
  const snippet = truncate(messageSnippet, 160);

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${subject}</title>
  <style>
    body, table, td { margin: 0; padding: 0; }
    img { border: 0; display: block; }
    @media (prefers-color-scheme: dark) {
      .email-wrapper { background-color: #0B1120 !important; }
      .card-outer { background-color: #111827 !important; border-color: #1F2937 !important; }
      .brand-bar { background-color: #111827 !important; }
      .hero-greeting { color: #94A3B8 !important; }
      .hero-headline { color: #F8FAFC !important; }
      .quote-box { background-color: #1E293B !important; border-color: #334155 !important; }
      .quote-text { color: #CBD5E1 !important; }
      .quote-sender { color: #64748B !important; }
      .footer-text { color: #64748B !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#F1F5F9;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F1F5F9;" class="email-wrapper">
    <tr>
      <td align="center" style="padding:32px 16px 48px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- Brand Bar -->
          <tr>
            <td class="brand-bar" style="background:#0F172A;padding:0 28px;height:56px;border-radius:16px 16px 0 0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:20px;font-weight:800;color:#FFFFFF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;letter-spacing:-0.5px;">
                    VidaBuddies
                  </td>
                  <td align="right" style="font-size:22px;">
                    ${emoji}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td class="card-outer" style="background:#FFFFFF;padding:32px 28px 24px;border-left:1px solid #E2E8F0;border-right:1px solid #E2E8F0;">
              <div class="hero-greeting" style="font-size:14px;color:#64748B;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin-bottom:8px;">
                Hey ${firstName} 👋
              </div>
              <div class="hero-headline" style="font-size:22px;font-weight:800;color:#0F172A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.3;letter-spacing:-0.3px;">
                ${senderName} ${actionVerb}${conversationName ? ` in ${conversationName}` : ""}
              </div>
            </td>
          </tr>

          <!-- Quoted message -->
          <tr>
            <td class="card-outer" style="background:#FFFFFF;padding:0 28px 24px;border-left:1px solid #E2E8F0;border-right:1px solid #E2E8F0;">
              <div class="quote-box" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:16px 20px;border-left:4px solid #3B82F6;">
                <div class="quote-sender" style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                  ${senderName}
                </div>
                <div class="quote-text" style="font-size:14px;color:#334155;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                  ${snippet}
                </div>
                ${chipsHtml}
              </div>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td class="card-outer" style="background:#FFFFFF;padding:8px 28px 32px;border-left:1px solid #E2E8F0;border-right:1px solid #E2E8F0;border-bottom:1px solid #E2E8F0;border-radius:0 0 16px 16px;text-align:center;">
              <a href="${chatUrl}"
                 style="display:inline-block;background:#3B82F6;color:#FFFFFF;font-size:14px;font-weight:700;padding:14px 36px;border-radius:10px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;letter-spacing:0.3px;">
                Open chat →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:28px 28px 0;text-align:center;">
              <div class="footer-text" style="font-size:12px;color:#64748B;line-height:1.7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                You're receiving this because someone messaged you in VidaBuddies Chat.<br/>
                <a href="${appUrl}/admin/settings" style="color:#475569;text-decoration:underline;">Manage notifications</a>
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

  const text = `Hey ${firstName},

${senderName} ${actionVerb}${conversationName ? ` in ${conversationName}` : ""}:

"${snippet}"

Open chat: ${chatUrl}

────────────────────────
You're receiving this because someone messaged you in VidaBuddies Chat.
Manage: ${appUrl}/admin/settings`;

  return { subject, html, text };
}
