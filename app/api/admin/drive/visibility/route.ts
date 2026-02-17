import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import FileVisibility from "@/lib/models/FileVisibility";

/**
 * GET — Get visibility for multiple file IDs
 * Query: ?ids=id1,id2,id3
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const ids = (searchParams.get("ids") || "").split(",").filter(Boolean);

    if (ids.length === 0) {
      return NextResponse.json({ visibilities: {} });
    }

    const records = await FileVisibility.find({ driveFileId: { $in: ids } }).lean();
    const visibilities: Record<string, string> = {};
    records.forEach((r: any) => {
      visibilities[r.driveFileId] = r.visibility;
    });

    return NextResponse.json({ visibilities });
  } catch (error: any) {
    console.error("[Visibility API] GET error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch visibility" },
      { status: 500 }
    );
  }
}

/**
 * PUT — Toggle or set visibility for a file
 * Body: { driveFileId: string, visibility: 'internal' | 'external' }
 */
export async function PUT(request: NextRequest) {
  try {
    await connectToDatabase();
    const { driveFileId, visibility } = await request.json();

    if (!driveFileId || !['internal', 'external'].includes(visibility)) {
      return NextResponse.json(
        { error: "driveFileId and visibility ('internal' or 'external') are required" },
        { status: 400 }
      );
    }

    const record = await FileVisibility.findOneAndUpdate(
      { driveFileId },
      { visibility, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    return NextResponse.json({ record });
  } catch (error: any) {
    console.error("[Visibility API] PUT error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update visibility" },
      { status: 500 }
    );
  }
}
