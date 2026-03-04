
import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Recreates the vidausers collection to reclaim disk space.
 * Safely reads all docs, drops collection, re-inserts them.
 * 
 * GET ?token=SECRET&confirm=yes
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const confirm = searchParams.get("confirm");
    const SECRET = process.env.CRON_SECRET || "vida-refresh-secret-123";

    if (token !== SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (confirm !== "yes") {
        return NextResponse.json({
            message: "This will recreate the vidausers collection to reclaim space. Pass ?confirm=yes to proceed.",
        });
    }

    try {
        await connectToDatabase();
        const db = mongoose.connection.db;
        if (!db) {
            return NextResponse.json({ error: "DB not connected" }, { status: 500 });
        }

        // 1. Read ALL documents (raw, preserving everything)
        const collection = db.collection("vidausers");
        const allDocs = await collection.find({}).toArray();

        if (allDocs.length === 0) {
            return NextResponse.json({ error: "Collection is empty! Aborting." }, { status: 400 });
        }

        const statsBefore = await db.command({ collStats: "vidausers" });

        // 2. Drop collection
        await collection.drop();

        // 3. Re-create by inserting all documents back (preserving _id and all fields)
        await db.collection("vidausers").insertMany(allDocs);

        // 4. Recreate indexes
        await db.collection("vidausers").createIndex({ email: 1 }, { unique: true });

        const statsAfter = await db.command({ collStats: "vidausers" });

        return NextResponse.json({
            message: "Collection recreated successfully!",
            docsPreserved: allDocs.length,
            before: {
                storageSize: `${(statsBefore.storageSize / 1024 / 1024).toFixed(2)} MB`,
                dataSize: `${(statsBefore.size / 1024).toFixed(2)} KB`,
            },
            after: {
                storageSize: `${(statsAfter.storageSize / 1024).toFixed(2)} KB`,
                dataSize: `${(statsAfter.size / 1024).toFixed(2)} KB`,
            },
            saved: `${((statsBefore.storageSize - statsAfter.storageSize) / 1024 / 1024).toFixed(2)} MB`,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
