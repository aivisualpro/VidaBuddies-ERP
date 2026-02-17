import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getDrive } from "@/lib/google-drive";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * POST — Send email with Google Drive file attachments
 * Body: { to, cc, subject, body, fileIds: [{ id, name, mimeType }] }
 */
export async function POST(request: NextRequest) {
  try {
    const { to, cc, subject, body, fileIds } = await request.json();

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
        } catch (err: any) {
          console.error(`Failed to download file ${file.name}:`, err.message);
          // Continue with other files
        }
      }
    }

    // Send via Resend
    const emailPayload: any = {
      from: "Vida Buddies <onboarding@resend.dev>",
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

    const result = await resend.emails.send(emailPayload);

    return NextResponse.json({
      success: true,
      emailId: result.data?.id,
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
