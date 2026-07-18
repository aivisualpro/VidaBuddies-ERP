import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

/**
 * Unified email sender (nodemailer SMTP / Office 365).
 *
 * The transporter is cached at module level (with connection pooling) so
 * repeated sends — e.g. the hourly automation cron — reuse the same
 * authenticated connection instead of opening a fresh one per email.
 */
let cachedTransporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (cachedTransporter) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.office365.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { ciphers: "SSLv3" },
    pool: true,
    maxConnections: 2,
    maxMessages: 50,
  });
  return cachedTransporter;
}

export async function sendMail(
  opts: SendMailOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, subject, html, text } = opts;

  try {
    const transporter = getTransporter();
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
    // Drop the cached transporter so the next send re-connects cleanly
    cachedTransporter = null;
    return { success: false, error: err.message };
  }
}
