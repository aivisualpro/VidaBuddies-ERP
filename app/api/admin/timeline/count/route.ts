import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaTimeline from "@/lib/models/VidaTimeline";

export async function GET() {
    try {
        await connectToDatabase();
        const count = await VidaTimeline.countDocuments({
            status: { $in: ["Open", "In Progress"] },
        });
        return NextResponse.json({ count });
    } catch (error) {
        return NextResponse.json({ count: 0 });
    }
}
