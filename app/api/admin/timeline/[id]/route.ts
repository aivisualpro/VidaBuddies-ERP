import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaTimeline from "@/lib/models/VidaTimeline";
import mongoose from "mongoose";

interface RouteParams {
    params: Promise<{ id: string }>;
}

/** Convert 24-char hex strings to ObjectId for ref fields */
function castRefFields(data: any) {
    const refFields = ["VBNumber", "VBSerialNumber", "VBShipmentNumber"];
    for (const field of refFields) {
        const v = data[field];
        if (v && typeof v === "string" && /^[a-f0-9]{24}$/i.test(v)) {
            try { data[field] = new mongoose.Types.ObjectId(v); } catch { /* keep string */ }
        }
    }
    return data;
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
    try {
        await connectToDatabase();
        const { id } = await params;
        const data = castRefFields(await req.json());
        const updated = await VidaTimeline.findByIdAndUpdate(id, data, { new: true });
        if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json(updated);
    } catch (error) {
        return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
    try {
        await connectToDatabase();
        const { id } = await params;
        const deleted = await VidaTimeline.findByIdAndDelete(id);
        if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json({ message: "Deleted" });
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }
}
