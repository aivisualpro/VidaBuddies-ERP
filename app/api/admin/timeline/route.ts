import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaTimeline from "@/lib/models/VidaTimeline";
import { getSession } from "@/lib/auth";
import { buildLookups, enrichTimelineEntry } from "@/lib/timeline/lookups";

import mongoose from "mongoose";

export async function GET(req: NextRequest) {
    try {
        await connectToDatabase();
        const { searchParams } = new URL(req.url);

        const toId = (v: string | null) => {
            if (!v) return undefined;
            if (/^[a-f0-9]{24}$/i.test(v)) {
                try { return new mongoose.Types.ObjectId(v); } catch { return v; }
            }
            return v;
        };

        const filter: any = {};
        if (searchParams.get("VBNumber")) filter.VBNumber = toId(searchParams.get("VBNumber"));
        if (searchParams.get("VBSerialNumber")) filter.VBSerialNumber = toId(searchParams.get("VBSerialNumber"));
        if (searchParams.get("VBShipmentNumber")) filter.VBShipmentNumber = toId(searchParams.get("VBShipmentNumber"));

        const [items, lookups] = await Promise.all([
            VidaTimeline.find(filter).sort({ timestamp: -1 }).lean(),
            buildLookups(),
        ]);

        // Enrich each entry with resolved display names
        const enriched = items.map((item: any) => enrichTimelineEntry(item, lookups));

        return NextResponse.json(enriched);
    } catch (error) {
        console.error("Failed to fetch timeline:", error);
        return NextResponse.json({ error: "Failed to fetch timeline" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        await connectToDatabase();
        const data = await req.json();

        // Auto-set createdBy from session
        const session = await getSession();
        if (session?.email) {
            data.createdBy = session.email;
        }
        if (!data.timestamp) {
            data.timestamp = new Date();
        }

        // Cast ref fields to ObjectId
        const refFields = ["VBNumber", "VBSerialNumber", "VBShipmentNumber"];
        for (const field of refFields) {
            const v = data[field];
            if (v && typeof v === "string" && /^[a-f0-9]{24}$/i.test(v)) {
                try { data[field] = new mongoose.Types.ObjectId(v); } catch { /* keep string */ }
            }
        }

        const newItem = await VidaTimeline.create(data);
        return NextResponse.json(newItem, { status: 201 });
    } catch (error) {
        console.error("Failed to create timeline entry:", error);
        return NextResponse.json({ error: "Failed to create timeline entry" }, { status: 500 });
    }
}
