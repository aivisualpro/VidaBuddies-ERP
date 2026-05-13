import { NextRequest, NextResponse } from "next/server";
import { getDrive } from "@/lib/google-drive";

/**
 * GET /api/admin/drive/thumbnail?fileId=...
 * 
 * Proxies Google Drive file thumbnails. Works for all file types
 * including PDFs, which don't work with the public lh3 URL.
 * 
 * Falls back to lh3 URL for image files, and uses the
 * Drive API thumbnailLink for documents.
 */
export async function GET(request: NextRequest) {
  const fileId = request.nextUrl.searchParams.get("fileId");

  if (!fileId) {
    return NextResponse.json({ error: "fileId is required" }, { status: 400 });
  }

  try {
    const drive = getDrive();

    // Get file metadata including thumbnailLink
    const file = await drive.files.get({
      fileId,
      fields: "id, mimeType, thumbnailLink",
      supportsAllDrives: true,
    });

    const mimeType = file.data.mimeType || "";
    const thumbnailLink = file.data.thumbnailLink;

    // For images, use the public lh3 URL (faster, no auth needed)
    if (mimeType.startsWith("image/")) {
      return NextResponse.redirect(
        `https://lh3.googleusercontent.com/d/${fileId}=w400`,
        { status: 302 }
      );
    }

    // For other file types (PDFs, docs), proxy the thumbnailLink
    if (thumbnailLink) {
      // The thumbnailLink requires auth, so we need to fetch it server-side
      const auth = drive.context._options.auth as any;
      let token: string | undefined;

      if (auth.getAccessToken) {
        const t = await auth.getAccessToken();
        token = typeof t === "string" ? t : t?.token;
      } else if (auth.credentials?.access_token) {
        token = auth.credentials.access_token;
      }

      // Fetch the thumbnail with larger size
      const thumbSized = thumbnailLink.replace(/=s\d+/, "=s400");
      const thumbRes = await fetch(thumbSized, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (thumbRes.ok) {
        const buffer = await thumbRes.arrayBuffer();
        const contentType = thumbRes.headers.get("content-type") || "image/png";

        return new NextResponse(buffer, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
          },
        });
      }
    }

    // Final fallback: try lh3 URL anyway
    return NextResponse.redirect(
      `https://lh3.googleusercontent.com/d/${fileId}=w400`,
      { status: 302 }
    );
  } catch (error: any) {
    console.error("[Thumbnail] Error:", error?.message || error);
    // Fallback to lh3 URL on error
    return NextResponse.redirect(
      `https://lh3.googleusercontent.com/d/${fileId}=w400`,
      { status: 302 }
    );
  }
}
