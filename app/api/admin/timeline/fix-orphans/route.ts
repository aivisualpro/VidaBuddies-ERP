import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaTimeline from "@/lib/models/VidaTimeline";
import VidaPO from "@/lib/models/VidaPO";
import VBcustomerPO from "@/lib/models/VBcustomerPO";
import mongoose from "mongoose";

/**
 * GET  — Diagnose orphaned VBNumber refs in timeline entries.
 *
 * POST — Fix orphans. Accepts optional body:
 *   { "renames": { "VB406": "VB451", "VB435-1-6": "VB435" } }
 *   Maps old display names → current display names for renamed POs.
 */

export async function GET() {
    try {
        await connectToDatabase();

        const [pos, cpos, entries] = await Promise.all([
            VidaPO.find({}, { _id: 1, VBNumber: 1 }).lean(),
            VBcustomerPO.find({}, { _id: 1, VBSerialNumber: 1, VBNumber: 1 }).lean(),
            VidaTimeline.find({ VBNumber: { $ne: null } }).lean(),
        ]);

        const poIdSet = new Set(pos.map((p: any) => p._id.toString()));
        const poDisplayMap: Record<string, string> = {};
        const poNameToIdMap: Record<string, string> = {};
        pos.forEach((p: any) => {
            const id = p._id.toString();
            poDisplayMap[id] = p.VBNumber;
            if (p.VBNumber) poNameToIdMap[p.VBNumber] = id;
        });

        const cpoToPoMap: Record<string, string> = {};
        const serialToPoMap: Record<string, string> = {};
        cpos.forEach((c: any) => {
            const cpoId = c._id.toString();
            const parentPoId = c.VBNumber?.toString() || "";
            if (parentPoId) {
                cpoToPoMap[cpoId] = parentPoId;
                if (c.VBSerialNumber) serialToPoMap[c.VBSerialNumber] = parentPoId;
            }
        });

        const orphans: any[] = [];
        for (const entry of entries) {
            const vbRaw = (entry as any).VBNumber?.toString() || "";
            if (!vbRaw || poIdSet.has(vbRaw)) continue;

            const resolvedViaCPO = cpoToPoMap[vbRaw] || null;
            const resolvedViaSerial = serialToPoMap[vbRaw] || null;
            const resolvedViaDisplayName = poNameToIdMap[vbRaw] || null;
            const suggestedPoId = resolvedViaCPO || resolvedViaSerial || resolvedViaDisplayName || null;

            orphans.push({
                _id: (entry as any)._id.toString(),
                VBNumber_current: vbRaw,
                VBNumber_isObjectId: /^[a-f0-9]{24}$/i.test(vbRaw),
                resolved_via: resolvedViaCPO ? "cpo_objectid" : resolvedViaSerial ? "serial_string" : resolvedViaDisplayName ? "display_name" : null,
                suggested_fix_poId: suggestedPoId,
                suggested_fix_poDisplay: suggestedPoId ? poDisplayMap[suggestedPoId] : null,
                comments: ((entry as any).comments || "").slice(0, 80),
                VBSerialNumber: (entry as any).VBSerialNumber?.toString() || "",
            });
        }

        const cpoIdSet = new Set(cpos.map((c: any) => c._id.toString()));
        const cpoNameToIdMap: Record<string, string> = {};
        cpos.forEach((c: any) => {
            if (c.VBSerialNumber) cpoNameToIdMap[c.VBSerialNumber] = c._id.toString();
        });
        let serialOrphans = 0;
        for (const entry of entries) {
            const serRaw = (entry as any).VBSerialNumber?.toString() || "";
            if (!serRaw) continue;
            if (cpoIdSet.has(serRaw)) continue;
            if (cpoNameToIdMap[serRaw]) serialOrphans++;
        }

        return NextResponse.json({
            total_entries: entries.length,
            vbNumber_orphans: orphans.length,
            serial_orphans: serialOrphans,
            orphans,
        });
    } catch (error) {
        console.error("Failed to diagnose timeline orphans:", error);
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        await connectToDatabase();

        // Accept optional renames map: { "VB406": "VB451" }
        let renames: Record<string, string> = {};
        try {
            const body = await req.json();
            if (body?.renames && typeof body.renames === "object") {
                renames = body.renames;
            }
        } catch { /* empty body is fine */ }

        const [pos, cpos, entries] = await Promise.all([
            VidaPO.find({}, { _id: 1, VBNumber: 1 }).lean(),
            VBcustomerPO.find({}, { _id: 1, VBSerialNumber: 1, VBNumber: 1 }).lean(),
            VidaTimeline.find({ VBNumber: { $ne: null } }).lean(),
        ]);

        const poIdSet = new Set(pos.map((p: any) => p._id.toString()));
        const poNameToIdMap: Record<string, string> = {};
        pos.forEach((p: any) => { if (p.VBNumber) poNameToIdMap[p.VBNumber] = p._id.toString(); });

        // Apply renames: e.g. "VB406" → look up "VB451" → get its ObjectId
        for (const [oldName, newName] of Object.entries(renames)) {
            const targetId = poNameToIdMap[newName];
            if (targetId) {
                poNameToIdMap[oldName] = targetId;
            }
        }

        const cpoToPoMap: Record<string, string> = {};
        const serialToPoMap: Record<string, string> = {};
        cpos.forEach((c: any) => {
            const parentPoId = c.VBNumber?.toString() || "";
            if (parentPoId) {
                cpoToPoMap[c._id.toString()] = parentPoId;
                if (c.VBSerialNumber) serialToPoMap[c.VBSerialNumber] = parentPoId;
            }
        });

        // CPO serial name → CPO ObjectId (for fixing VBSerialNumber field)
        const cpoIdSet = new Set(cpos.map((c: any) => c._id.toString()));
        const cpoNameToIdMap: Record<string, string> = {};
        cpos.forEach((c: any) => {
            if (c.VBSerialNumber) cpoNameToIdMap[c.VBSerialNumber] = c._id.toString();
        });

        let fixedVB = 0;
        let fixedSerial = 0;
        let unfixable = 0;
        const details: any[] = [];

        for (const entry of entries) {
            const vbRaw = (entry as any).VBNumber?.toString() || "";
            const serRaw = (entry as any).VBSerialNumber?.toString() || "";
            const update: Record<string, any> = {};

            // Fix VBNumber if orphaned
            if (vbRaw && !poIdSet.has(vbRaw)) {
                const suggestedPoId = cpoToPoMap[vbRaw] || serialToPoMap[vbRaw] || poNameToIdMap[vbRaw] || null;
                if (suggestedPoId && poIdSet.has(suggestedPoId)) {
                    update.VBNumber = new mongoose.Types.ObjectId(suggestedPoId);
                    fixedVB++;
                    details.push({
                        _id: (entry as any)._id.toString(),
                        field: "VBNumber",
                        old: vbRaw,
                        new: suggestedPoId,
                    });
                } else {
                    unfixable++;
                    details.push({
                        _id: (entry as any)._id.toString(),
                        field: "VBNumber",
                        old: vbRaw,
                        error: "Could not resolve to a valid PO",
                    });
                }
            }

            // Fix VBSerialNumber if it's a display string instead of ObjectId
            if (serRaw && !cpoIdSet.has(serRaw) && cpoNameToIdMap[serRaw]) {
                update.VBSerialNumber = new mongoose.Types.ObjectId(cpoNameToIdMap[serRaw]);
                fixedSerial++;
            }

            if (Object.keys(update).length > 0) {
                await VidaTimeline.findByIdAndUpdate((entry as any)._id, update);
            }
        }

        return NextResponse.json({ fixedVB, fixedSerial, unfixable, details });
    } catch (error) {
        console.error("Failed to fix timeline orphans:", error);
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}
