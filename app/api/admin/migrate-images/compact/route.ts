
import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

/**
 * Compacts the vidausers collection to reclaim disk space after migration.
 * GET ?token=SECRET
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const SECRET = process.env.CRON_SECRET || "vida-refresh-secret-123";

    if (token !== SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        await connectToDatabase();

        const db = mongoose.connection.db;
        if (!db) {
            return NextResponse.json({ error: "Database not connected" }, { status: 500 });
        }

        // Get stats before compact
        const statsBefore = await db.command({ collStats: "vidausers" });

        // Run compact
        try {
            await db.command({ compact: "vidausers" });
        } catch (compactErr: any) {
            // On Atlas free/shared tier, compact may not be available
            // Alternative: reindex or just report the actual data size
            return NextResponse.json({
                message: "Compact not available on this MongoDB tier. But your data IS smaller!",
                note: "Atlas free/shared tiers don't support compact. The storage will be reclaimed gradually by WiredTiger.",
                stats: {
                    storageSize: `${(statsBefore.storageSize / 1024 / 1024).toFixed(2)} MB`,
                    actualDataSize: `${(statsBefore.size / 1024).toFixed(2)} KB`,
                    avgDocSize: `${statsBefore.avgObjSize} bytes`,
                    docCount: statsBefore.count,
                }
            });
        }

        // Get stats after compact
        const statsAfter = await db.command({ collStats: "vidausers" });

        return NextResponse.json({
            message: "Collection compacted successfully!",
            before: {
                storageSize: `${(statsBefore.storageSize / 1024 / 1024).toFixed(2)} MB`,
                dataSize: `${(statsBefore.size / 1024).toFixed(2)} KB`,
            },
            after: {
                storageSize: `${(statsAfter.storageSize / 1024 / 1024).toFixed(2)} MB`,
                dataSize: `${(statsAfter.size / 1024).toFixed(2)} KB`,
            },
            saved: `${((statsBefore.storageSize - statsAfter.storageSize) / 1024 / 1024).toFixed(2)} MB`
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
