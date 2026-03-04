import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaTimeline from "@/lib/models/VidaTimeline";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
    try {
        await connectToDatabase();
        const { searchParams } = new URL(req.url);

        const filter: any = {};
        if (searchParams.get("vbpoNo")) filter.vbpoNo = searchParams.get("vbpoNo");
        if (searchParams.get("poNo")) filter.poNo = searchParams.get("poNo");
        if (searchParams.get("svbid")) filter.svbid = searchParams.get("svbid");

        const items = await VidaTimeline.find(filter).sort({ timestamp: -1 });
        return NextResponse.json(items);
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
