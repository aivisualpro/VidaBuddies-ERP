import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getDrive } from "@/lib/google-drive";
import connectToDatabase from "@/lib/db";
import EmailRecord from "@/lib/models/EmailRecord";
import { getSession } from "@/lib/auth";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.office365.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false, // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: { ciphers: "SSLv3" },
});

/**
 * POST — Send email with Google Drive file attachments
 * Body: { to, cc, subject, body, fileIds: [{ id, name, mimeType, size }], vbpoNo?, folderPath? }
 */
export async function POST(request: NextRequest) {
  try {
    const { to, cc, subject, body, fileIds, vbpoNo, folderPath, htmlContentForAttachedPdf, pdfName } = await request.json();

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

    // 2) Then loop through any Google Drive files
    if (fileIds && fileIds.length > 0) {
      const drive = getDrive();

      for (const file of fileIds) {
        try {
          // Skip folders
          if (file.mimeType === "application/vnd.google-apps.folder") continue;

          let response;
          const isGoogleDoc = file.mimeType?.startsWith("application/vnd.google-apps.");

          if (isGoogleDoc) {
            response = await drive.files.export(
              { fileId: file.id, mimeType: "application/pdf" },
              { responseType: "arraybuffer" }
            );
          } else {
            response = await drive.files.get(
              { fileId: file.id, alt: "media" },
              { responseType: "arraybuffer" }
            );
          }

          const buffer = Buffer.from(response.data as ArrayBuffer);
          const filename = isGoogleDoc
            ? file.name.replace(/\.[^.]+$/, "") + ".pdf"
            : file.name;

          attachments.push({ filename, content: buffer });
          attachmentsMeta.push({
            fileId: file.id,
            name: file.name,
            mimeType: file.mimeType,
            size: file.size || "0",
          });
        } catch (err: any) {
          console.error(`Failed to download file ${file.name}:`, err.message);
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
    if (vbpoNo) {
      try {
        await connectToDatabase();
        await EmailRecord.create({
          vbpoNo,
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
