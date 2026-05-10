import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { getSession } from "@/lib/auth";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * POST /api/admin/chat/upload
 *
 * Accepts multipart form-data with a single "file" field.
 * Uploads to Cloudinary under vida-buddies/chat/ folder.
 * Returns: { url, name, mime, size, width?, height?, durationMs? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      return NextResponse.json(
        { error: "Cloudinary not configured" },
        { status: 503 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file)
      return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mime = file.type || "application/octet-stream";
    const isImage = mime.startsWith("image/");
    const isAudio = mime.startsWith("audio/");
    const isVideo = mime.startsWith("video/");

    const result: any = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: "vida-buddies/chat",
          resource_type: isImage
            ? "image"
            : isAudio || isVideo
            ? "video"
            : "raw",
          // Get image dimensions and audio/video duration
          ...(isImage ? { image_metadata: true } : {}),
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(buffer);
    });

    const response: any = {
      url: result.secure_url || result.url,
      name: file.name,
      mime,
      size: file.size,
    };

    // Image dimensions
    if (result.width) response.width = result.width;
    if (result.height) response.height = result.height;

    // Audio/video duration
    if (result.duration)
      response.durationMs = Math.round(result.duration * 1000);

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("[Chat Upload]", error);
    return NextResponse.json(
      { error: error.message || "Upload failed" },
      { status: 500 }
    );
  }
}
