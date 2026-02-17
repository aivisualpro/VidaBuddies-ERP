import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getDrive } from "@/lib/google-drive";
import connectToDatabase from "@/lib/db";
import EmailRecord from "@/lib/models/EmailRecord";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * POST — Send email with Google Drive file attachments
 * Body: { to, cc, subject, body, fileIds: [{ id, name, mimeType, size }], vbpoNo?, folderPath? }
 */
export async function POST(request: NextRequest) {
  try {
    const { to, cc, subject, body, fileIds, vbpoNo, folderPath } = await request.json();

    if (!to || !subject) {
      return NextResponse.json(
        { error: "To and Subject are required" },
        { status: 400 }
      );
    }

    // Parse email addresses
    const toAddresses = to.split(",").map((e: string) => e.trim()).filter(Boolean);
    const ccAddresses = cc
      ? cc.split(",").map((e: string) => e.trim()).filter(Boolean)
      : [];

    // Download files from Google Drive
    const attachments: { filename: string; content: Buffer }[] = [];
    const attachmentsMeta: { fileId: string; name: string; mimeType: string; size: string }[] = [];

    if (fileIds && fileIds.length > 0) {
      const drive = getDrive();

      for (const file of fileIds) {
        try {
          // Skip folders
          if (file.mimeType === "application/vnd.google-apps.folder") continue;

          // For Google Docs native formats, export as PDF
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
          // Continue with other files
        }
      }
    }

    // Send via Resend
    const fromAddress = "Vida Buddies <info@app.vidabuddies.com>";
    const emailPayload: any = {
      from: fromAddress,
      to: toAddresses,
      subject,
      html: body.replace(/\n/g, "<br/>"),
    };

    if (ccAddresses.length > 0) {
      emailPayload.cc = ccAddresses;
    }

    if (attachments.length > 0) {
      emailPayload.attachments = attachments;
    }

    let resendEmailId = "";
    let status: "sent" | "failed" = "sent";
    let error = "";

    try {
      const result = await resend.emails.send(emailPayload);
      resendEmailId = result.data?.id || "";
    } catch (sendErr: any) {
      status = "failed";
      error = sendErr.message || "Failed to send";
      console.error("[Email API] Resend error:", sendErr);
    }

    // Save email record to database
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
        // Don't fail the request if DB save fails
      }
    }

    if (status === "failed") {
      return NextResponse.json({ error: error || "Failed to send email" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      emailId: resendEmailId,
      attachmentCount: attachments.length,
    });
  } catch (error: any) {
    console.error("[Email API] Send error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send email" },
      { status: 500 }
    );
  }
}
