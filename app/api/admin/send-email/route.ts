import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getDrive } from "@/lib/google-drive";
import connectToDatabase from "@/lib/db";
import EmailRecord from "@/lib/models/EmailRecord";
import { getSession } from "@/lib/auth";
import mongoose from "mongoose";

/**
 * SMTP Transport — For Office365 with Basic Auth, ensure:
 * 1. SMTP AUTH is enabled for the mailbox in Exchange Admin
 * 2. Security Defaults / MFA may require an App Password instead of regular password
 * 3. Update SMTP_PASS in .env.local with the correct App Password
 */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.office365.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false, // STARTTLS on port 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  pool: true,
  maxConnections: 3,
  requireTLS: true,
  tls: {
    minVersion: "TLSv1.2",
    ciphers: "HIGH",
  },
  connectionTimeout: 10000,  // 10s to establish connection
  greetingTimeout: 10000,    // 10s for SMTP greeting
  socketTimeout: 30000,      // 30s for socket idle
});

/**
 * POST — Send email with Google Drive file attachments
 * Body: { to, cc, subject, body, fileIds: [{ id, name, mimeType, size }], vbpoNo?, folderPath? }
 */
export async function POST(request: NextRequest) {
  try {
    const { to, cc, subject, body, fileIds, vbpoNo, VBNumber: rawVBNumber, folderPath, htmlContentForAttachedPdf, pdfName, type, reference } = await request.json();
    const vbRef = rawVBNumber || vbpoNo; // accept both, prefer VBNumber

    if (!to || !subject) {
      return NextResponse.json(
        { error: "To and Subject are required" },
        { status: 400 }
      );
    }

    // Get logged-in user info from session
    const session = await getSession();
    const senderName = session?.name || "Unknown";
    const senderEmail = session?.email || "Unknown";

    // Parse email addresses
    const toAddresses = to.split(",").map((e: string) => e.trim()).filter(Boolean);
    const ccAddresses = cc
      ? cc.split(",").map((e: string) => e.trim()).filter(Boolean)
      : [];

    // Execute massive tasks (Google Drive Download -> NodeMailer -> MongoDB)
    let attachments: { filename: string; content: Buffer }[] = [];
    let attachmentsMeta: { fileId: string; name: string; mimeType: string; size: string }[] = [];

    // 1) First process embedded HTML -> PDF integration
    if (htmlContentForAttachedPdf) {
      try {
        const html_to_pdf = require('html-pdf-node');
        const options = { 
          format: 'A4', 
          margin: { top: "20px", bottom: "20px", left: "20px", right: "20px" },
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] 
        };
        const file = { content: htmlContentForAttachedPdf };
        const pdfBuffer = await Promise.race([
          html_to_pdf.generatePdf(file, options),
          new Promise((_, reject) => setTimeout(() => reject(new Error("PDF Generation Timeout")), 15000))
        ]) as Buffer;
        const resolvedName = pdfName || "Document.pdf";
        
        attachments.push({ filename: resolvedName, content: pdfBuffer });
        attachmentsMeta.push({
          fileId: "html-pdf-generated",
          name: resolvedName,
          mimeType: "application/pdf",
          size: pdfBuffer.length.toString(),
        });
      } catch (err: any) {
        console.error("[Email API] Failed to generate PDF from HTML:", err.message);
      }
    }

    // 2) Download Google Drive files in parallel
    if (fileIds && fileIds.length > 0) {
      const drive = getDrive();

      const downloadResults = await Promise.allSettled(
        fileIds
          .filter((file: any) => file.mimeType !== "application/vnd.google-apps.folder")
          .map(async (file: any) => {
            const isGoogleDoc = file.mimeType?.startsWith("application/vnd.google-apps.");
            const response = isGoogleDoc
              ? await drive.files.export(
                  { fileId: file.id, mimeType: "application/pdf" },
                  { responseType: "arraybuffer" }
                )
              : await drive.files.get(
                  { fileId: file.id, alt: "media" },
                  { responseType: "arraybuffer" }
                );

            const buffer = Buffer.from(response.data as ArrayBuffer);
            const filename = isGoogleDoc
              ? file.name.replace(/\.[^.]+$/, "") + ".pdf"
              : file.name;

            return { filename, content: buffer, meta: { fileId: file.id, name: file.name, mimeType: file.mimeType, size: file.size || "0" } };
          })
      );

      for (const result of downloadResults) {
        if (result.status === "fulfilled") {
          attachments.push({ filename: result.value.filename, content: result.value.content });
          attachmentsMeta.push(result.value.meta);
        } else {
          console.error("[Email API] File download failed:", result.reason?.message);
        }
      }
    }

    // Append "Sent by" signature
    const sentBySignature = `<br/><br/><div style="border-top: 1px solid #e5e7eb; padding-top: 12px; margin-top: 16px; color: #6b7280; font-size: 13px;">Sent by<br/><strong style="color: #374151;">${senderName}</strong><br/>${senderEmail}</div>`;
    const fullBody = body.replace(/\n/g, "<br/>") + sentBySignature;

    const fromAddress = `"Vida Buddies Notification" <${process.env.SMTP_USER}>`;
    const emailPayload: any = {
      from: fromAddress,
      to: toAddresses,
      subject,
      html: fullBody,
    };

    if (ccAddresses.length > 0) emailPayload.cc = ccAddresses;
    if (attachments.length > 0) emailPayload.attachments = attachments;

    let resendEmailId = "";
    let status: "sent" | "failed" = "sent";
    let error = "";

    try {
      const info = await transporter.sendMail(emailPayload);
      resendEmailId = info.messageId || "";
    } catch (sendErr: any) {
      status = "failed";
      error = sendErr.message || "Failed to send";
      console.error("[Email API] Nodemailer error:", sendErr);
    }

    // Save email record
    if (vbRef) {
      try {
        await connectToDatabase();
        // Cast to ObjectId if it looks like one
        let vbValue: any = vbRef;
        if (typeof vbRef === "string" && /^[a-f0-9]{24}$/i.test(vbRef)) {
          try { vbValue = new mongoose.Types.ObjectId(vbRef); } catch { /* keep string */ }
        }
        await EmailRecord.create({
          VBNumber: vbValue,
          folderPath: folderPath || "",
          from: fromAddress,
          to: toAddresses,
          cc: ccAddresses,
          subject,
          body,
          attachments: attachmentsMeta,
          resendEmailId,
          status,
          error: error || undefined,
          sentAt: new Date(),
          type: type || "Invoice",
          reference: reference || "",
        });
      } catch (dbErr: any) {
        console.error("[Email API] DB save error:", dbErr);
      }
    }

    if (status === "failed") {
      throw new Error(error);
    }

    return NextResponse.json({
      success: true,
      emailId: resendEmailId,
      attachmentCount: attachmentsMeta.length,
      message: "Email sent successfully",
    });
  } catch (error: any) {
    console.error("[Email API] Send error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send email" },
      { status: 500 }
    );
  }
}
