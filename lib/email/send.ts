import nodemailer from "nodemailer";

interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

/**
 * Unified email sender.
 * Uses Resend if RESEND_API_KEY is set, otherwise falls back to
 * the existing nodemailer SMTP transporter (Office 365).
 */
export async function sendMail(opts: SendMailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, subject, html, text } = opts;

  // Resend path
  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);

      const fromAddress =
        process.env.NOTIFY_EMAIL_FROM || "VidaBuddies <noreply@vidabuddies.com>";

      const result = await resend.emails.send({
        from: fromAddress,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text,
      });

      if (result.error) {
        console.error("[sendMail/Resend] Error:", result.error);
        return { success: false, error: result.error.message };
      }

      return { success: true, messageId: result.data?.id };
    } catch (err: any) {
      console.error("[sendMail/Resend] Exception:", err);
      // Fall through to SMTP
    }
  }

  // SMTP fallback (nodemailer / Office 365)
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.office365.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: { ciphers: "SSLv3" },
    });

    const fromAddress = `"VidaBuddies" <${process.env.SMTP_USER}>`;

    const info = await transporter.sendMail({
      from: fromAddress,
      to: Array.isArray(to) ? to.join(", ") : to,
      subject,
      html,
      text,
    });

    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    console.error("[sendMail/SMTP] Error:", err);
    return { success: false, error: err.message };
  }
}
