import { NextRequest, NextResponse } from "next/server";
import { ensureFolderPath, ensureSubFolderPath, uploadFile, getDrive } from "@/lib/google-drive";
import { PDFDocument } from "pdf-lib";

const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDERID!;

export async function POST(request: NextRequest) {
  try {
    const { fileIds, poNumber, spoNumber, shipNumber, folderId: explicitFolderId, fileName } = await request.json();

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length < 2) {
      return NextResponse.json(
        { error: "At least 2 file IDs are required to merge" },
        { status: 400 }
      );
    }

    const drive = getDrive();

    // Initialize a new PDF Document
    const mergedPdf = await PDFDocument.create();

    for (const fileId of fileIds) {
      // Get file metadata
      const fileMeta = await drive.files.get({
        fileId: fileId,
        fields: "id, name, mimeType",
        supportsAllDrives: true,
      });

      const { name, mimeType } = fileMeta.data;

      // Download file content
      const fileRes = await drive.files.get(
        { fileId: fileId, alt: "media", supportsAllDrives: true },
        { responseType: "arraybuffer" }
      );
      
      const buffer = Buffer.from(fileRes.data as ArrayBuffer);

      if (mimeType === "application/pdf") {
        try {
          const pdfToMerge = await PDFDocument.load(buffer, { ignoreEncryption: true });
          const copiedPages = await mergedPdf.copyPages(pdfToMerge, pdfToMerge.getPageIndices());
          copiedPages.forEach((page) => mergedPdf.addPage(page));
        } catch (e) {
          console.error(`Failed to load PDF: ${name}`, e);
          const page = mergedPdf.addPage();
          page.drawText(`Failed to merge PDF: ${name}`, { x: 50, y: 700 });
        }
      } else if (mimeType?.startsWith("image/")) {
        try {
          let image;
          if (mimeType === "image/png") {
            image = await mergedPdf.embedPng(buffer);
          } else if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
            image = await mergedPdf.embedJpg(buffer);
          } else {
             const page = mergedPdf.addPage();
             page.drawText(`Unsupported image format: ${name}`, { x: 50, y: 700 });
             continue;
          }

          const imageDims = image.scale(1);
          // Create page with exact image dimensions
          const page = mergedPdf.addPage([imageDims.width, imageDims.height]);
          page.drawImage(image, {
            x: 0,
            y: 0,
            width: imageDims.width,
            height: imageDims.height,
          });
        } catch (e) {
          const page = mergedPdf.addPage();
          page.drawText(`Failed to embed image: ${name}`, { x: 50, y: 700 });
        }
      } else {
        const page = mergedPdf.addPage();
        page.drawText(`Unsupported file format: ${name}`, { x: 50, y: 700 });
      }
    }

    // Generate merged PDF buffer
    const mergedPdfBytes = await mergedPdf.save();
    const mergedPdfBuffer = Buffer.from(mergedPdfBytes);

    // Upload back to drive
    let targetFolderId = explicitFolderId;
    if (!targetFolderId) {
      targetFolderId = await ensureFolderPath(ROOT_FOLDER_ID, poNumber, spoNumber, shipNumber);
    }

    const finalName = fileName ? (fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`) : `Merged_Documents_${Date.now()}.pdf`;
    
    const result = await uploadFile(
      targetFolderId,
      finalName,
      "application/pdf",
      mergedPdfBuffer
    );

    return NextResponse.json({ uploaded: result, folderId: targetFolderId });
  } catch (error: any) {
    console.error("[Drive API] Merge error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to merge files" },
      { status: 500 }
    );
  }
}
