import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaUser from "@/lib/models/VidaUser";
import EmailRecord from "@/lib/models/EmailRecord";

/**
 * GET — Fetch unique email contacts for autocomplete suggestions
 * Sources: VidaUser emails + previously used To/Cc emails from EmailRecord
 */
export async function GET() {
    try {
        await connectToDatabase();

        // 1. Get all active user emails
        const users = await VidaUser.find({ isActive: true }, { name: 1, email: 1 }).lean();
        const userContacts = users.map((u: any) => ({
            email: u.email,
            name: u.name || "",
            source: "team" as const,
        }));

        // 2. Get unique emails from past EmailRecord to/cc fields
        const emailRecords = await EmailRecord.find(
            { status: "sent" },
            { to: 1, cc: 1 }
        )
            .sort({ sentAt: -1 })
            .limit(200)
            .lean();

        const pastEmailSet = new Set<string>();
        for (const rec of emailRecords) {
            const record = rec as any;
            if (record.to) record.to.forEach((e: string) => pastEmailSet.add(e.toLowerCase().trim()));
            if (record.cc) record.cc.forEach((e: string) => pastEmailSet.add(e.toLowerCase().trim()));
        }

        // Merge: user emails take priority (they get names)
        const userEmailSet = new Set(userContacts.map((u) => u.email.toLowerCase()));
        const pastContacts = Array.from(pastEmailSet)
            .filter((e) => !userEmailSet.has(e) && e.includes("@"))
            .map((email) => ({
                email,
                name: "",
                source: "recent" as const,
            }));

        const contacts = [...userContacts, ...pastContacts];

        return NextResponse.json({ contacts });
    } catch (error: any) {
        console.error("[Email Contacts API] Error:", error);
        return NextResponse.json({ contacts: [] });
    }
}
