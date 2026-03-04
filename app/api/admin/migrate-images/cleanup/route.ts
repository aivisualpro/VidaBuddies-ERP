
import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaUser from "@/lib/models/VidaUser";

export const dynamic = "force-dynamic";

/**
 * Removes the _backup_ fields from VidaUser after migration is confirmed.
 * Only run this AFTER verifying all Cloudinary URLs work correctly.
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
            message: "This will permanently delete backup base64 data. Pass ?confirm=yes to proceed.",
            warning: "Make sure all Cloudinary URLs are working correctly first!"
        });
    }

    try {
        await connectToDatabase();

        const result = await VidaUser.updateMany(
            {},
            { $unset: { _backup_profilePicture: "", _backup_signature: "" } }
        );

        return NextResponse.json({
            message: "Backup fields removed successfully",
            modifiedCount: result.modifiedCount,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
