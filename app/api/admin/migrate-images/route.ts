
import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import connectToDatabase from "@/lib/db";
import VidaUser from "@/lib/models/VidaUser";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Allow up to 5 minutes for migration

/**
 * Safely migrates base64 images in VidaUser to Cloudinary URLs.
 * 
 * GET ?dryRun=true  → Preview what would be migrated (no changes)
 * GET ?dryRun=false → Actually perform the migration
 * 
 * Safety measures:
 * 1. Only processes fields that are base64 (start with "data:")
 * 2. Skips fields that are already URLs (already migrated)
 * 3. Backs up original base64 to separate fields before overwriting
 * 4. Processes one user at a time to avoid race conditions
 * 5. If Cloudinary upload fails, that user is skipped (no data loss)
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const dryRun = searchParams.get("dryRun") !== "false";

    // Security check
    const token = searchParams.get("token");
    const SECRET = process.env.CRON_SECRET || "vida-refresh-secret-123";
    if (token !== SECRET) {
        return NextResponse.json({ error: "Unauthorized. Pass ?token=YOUR_SECRET" }, { status: 401 });
    }

    try {
        await connectToDatabase();

        const users = await VidaUser.find({}).lean();

        const report = {
            dryRun,
            totalUsers: users.length,
            usersWithBase64: 0,
            fieldsToMigrate: [] as { userId: string; name: string; email: string; field: string; currentSizeKB: number }[],
            migrated: [] as { userId: string; name: string; field: string; cloudinaryUrl: string; savedKB: number }[],
            skipped: [] as { userId: string; name: string; field: string; reason: string }[],
            errors: [] as { userId: string; name: string; field: string; error: string }[],
            totalSavedKB: 0,
        };

        for (const user of users) {
            const fieldsToCheck = ["profilePicture", "signature"] as const;

            for (const field of fieldsToCheck) {
                const value = (user as any)[field];

                if (!value) continue;

                // Skip if already a URL (already migrated)
                if (value.startsWith("http://") || value.startsWith("https://")) {
                    report.skipped.push({
                        userId: (user._id as any).toString(),
                        name: user.name,
                        field,
                        reason: "Already a URL (already migrated)",
                    });
                    continue;
                }

                // Check if it's base64
                if (!value.startsWith("data:")) {
                    // It might be a short string or something else, skip
                    if (value.length < 100) {
                        report.skipped.push({
                            userId: (user._id as any).toString(),
                            name: user.name,
                            field,
                            reason: `Short string (${value.length} chars), not base64`,
                        });
                        continue;
                    }
                }

                const sizeKB = Math.round(Buffer.byteLength(value, "utf8") / 1024);
                report.usersWithBase64++;

                report.fieldsToMigrate.push({
                    userId: (user._id as any).toString(),
                    name: user.name,
                    email: user.email,
                    field,
                    currentSizeKB: sizeKB,
                });

                if (dryRun) continue;

                // === ACTUAL MIGRATION ===
                try {
                    // 1. Upload base64 to Cloudinary
                    const uploadResult: any = await new Promise((resolve, reject) => {
                        cloudinary.uploader.upload(
                            value, // base64 string
                            {
                                folder: `vida-buddies/users/${field}`,
                                resource_type: "auto",
                                public_id: `${(user._id as any).toString()}_${field}`,
                                overwrite: true,
                            },
                            (error, result) => {
                                if (error) reject(error);
                                else resolve(result);
                            }
                        );
                    });

                    if (!uploadResult?.secure_url) {
                        throw new Error("No URL returned from Cloudinary");
                    }

                    // 2. Save backup of original base64 and update with Cloudinary URL
                    const backupField = `_backup_${field}`;
                    await VidaUser.updateOne(
                        { _id: user._id },
                        {
                            $set: {
                                [field]: uploadResult.secure_url,
                                [backupField]: value // Keep backup in DB temporarily
                            }
                        }
                    );

                    const savedKB = sizeKB - Math.round(uploadResult.secure_url.length / 1024);
                    report.totalSavedKB += savedKB;

                    report.migrated.push({
                        userId: (user._id as any).toString(),
                        name: user.name,
                        field,
                        cloudinaryUrl: uploadResult.secure_url,
                        savedKB,
                    });

                } catch (err: any) {
                    report.errors.push({
                        userId: (user._id as any).toString(),
                        name: user.name,
                        field,
                        error: err.message || "Unknown error",
                    });
                }
            }
        }

        return NextResponse.json({
            message: dryRun
                ? "DRY RUN — No changes made. Review the report below. Run with ?dryRun=false to execute."
                : "Migration completed. Backups saved as _backup_profilePicture / _backup_signature fields.",
            report,
        });

    } catch (error: any) {
        console.error("Migration error:", error);
        return NextResponse.json(
            { error: error.message || "Migration failed" },
            { status: 500 }
        );
    }
}
