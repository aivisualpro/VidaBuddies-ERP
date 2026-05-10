import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaTimeline from "@/lib/models/VidaTimeline";
import VidaPO from "@/lib/models/VidaPO";
import VBcustomerPO from "@/lib/models/VBcustomerPO";
import VBshipping from "@/lib/models/VBshipping";
import { getSession } from "@/lib/auth";

// Build ID → display-name lookup maps (cached per request)
async function buildLookups() {
    const [pos, cpos, ships] = await Promise.all([
        VidaPO.find({}, { _id: 1, vbpoNo: 1, VBNumber: 1 }).lean(),
        VBcustomerPO.find({}, { _id: 1, VBSerialNumber: 1, poNo: 1 }).lean(),
        VBshipping.find({}, { _id: 1, VBShipmentNumber: 1, svbid: 1 }).lean(),
    ]);

    const poMap: Record<string, string> = {};
    pos.forEach((p: any) => { poMap[p._id.toString()] = p.vbpoNo || p.VBNumber || p._id.toString(); });

    const cpoMap: Record<string, string> = {};
    cpos.forEach((c: any) => { cpoMap[c._id.toString()] = c.VBSerialNumber || c.poNo || c._id.toString(); });

    const shipMap: Record<string, string> = {};
    ships.forEach((s: any) => { shipMap[s._id.toString()] = s.VBShipmentNumber || s.svbid || s._id.toString(); });

    return { poMap, cpoMap, shipMap };
}

export async function GET(req: NextRequest) {
    try {
        await connectToDatabase();
        const { searchParams } = new URL(req.url);

        const filter: any = {};
        // Support both _id-based and label-based lookups for backward compatibility
        if (searchParams.get("VBNumber")) {
            const val = searchParams.get("VBNumber")!;
            filter.$and = filter.$and || [];
            filter.$and.push({ $or: [{ VBNumber: val }, { _VBNumberLabel: val }] });
        }
        if (searchParams.get("VBSerialNumber")) {
            const val = searchParams.get("VBSerialNumber")!;
            filter.$and = filter.$and || [];
            filter.$and.push({ $or: [{ VBSerialNumber: val }, { _VBSerialNumberLabel: val }] });
        }
        if (searchParams.get("VBShipmentNumber")) {
            const val = searchParams.get("VBShipmentNumber")!;
            filter.$and = filter.$and || [];
            filter.$and.push({ $or: [{ VBShipmentNumber: val }, { _VBShipmentNumberLabel: val }] });
        }

        const [items, { poMap, cpoMap, shipMap }] = await Promise.all([
            VidaTimeline.find(filter).sort({ timestamp: -1 }).lean(),
            buildLookups(),
        ]);

        // Enrich each entry with resolved display names
        const enriched = items.map((item: any) => ({
            ...item,
            _VBNumberDisplay: item.VBNumber ? (poMap[item.VBNumber] || item._VBNumberLabel || item.VBNumber) : "",
            _VBSerialNumberDisplay: item.VBSerialNumber ? (cpoMap[item.VBSerialNumber] || item._VBSerialNumberLabel || item.VBSerialNumber) : "",
            _VBShipmentNumberDisplay: item.VBShipmentNumber ? (shipMap[item.VBShipmentNumber] || item._VBShipmentNumberLabel || item.VBShipmentNumber) : "",
        }));

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

        const newItem = await VidaTimeline.create(data);
        return NextResponse.json(newItem, { status: 201 });
    } catch (error) {
        console.error("Failed to create timeline entry:", error);
        return NextResponse.json({ error: "Failed to create timeline entry" }, { status: 500 });
    }
}
