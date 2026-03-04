import connectToDatabase from "@/lib/db";
import VidaTimeline from "@/lib/models/VidaTimeline";

interface TimelineLogOptions {
    vbpoNo?: string;
    poNo?: string;
    svbid?: string;
    type?: "Notes" | "Shipping Status" | "Action Required";
    category?: string;
    comments: string;
    status?: string;
    createdBy?: string;
}

/**
 * Creates an automatic timeline entry (system log).
 * Call this from any API route when important changes happen.
 */
export async function createTimelineLog(opts: TimelineLogOptions) {
    try {
        await connectToDatabase();
        await VidaTimeline.create({
            vbpoNo: opts.vbpoNo,
            poNo: opts.poNo,
            svbid: opts.svbid,
            type: opts.type || "Notes",
            category: opts.category,
            comments: opts.comments,
            status: opts.status || "Closed",
            createdBy: opts.createdBy || "System",
            timestamp: new Date(),
            date: new Date(),
        });
    } catch (error) {
        console.error("Failed to create timeline log:", error);
        // Don't throw — timeline logging should never break the main operation
    }
}

/**
 * Detects field changes between old and new data objects.
 * Returns an array of human-readable change descriptions.
 */
export function detectChanges(
    oldData: Record<string, any>,
    newData: Record<string, any>,
    fieldLabels: Record<string, string> = {}
): string[] {
    const changes: string[] = [];
    const skipFields = ["_id", "__v", "updatedAt", "createdAt", "timestamp", "shippingTrackingRecords"];

    for (const key of Object.keys(newData)) {
        if (skipFields.includes(key)) continue;
        const oldVal = oldData[key];
        const newVal = newData[key];

        // Skip objects/arrays (nested docs)
        if (typeof newVal === "object" && newVal !== null && !Array.isArray(newVal)) continue;
        if (Array.isArray(newVal)) continue;

        // Normalize for comparison
        const oldStr = oldVal == null ? "" : String(oldVal).trim();
        const newStr = newVal == null ? "" : String(newVal).trim();

        if (oldStr !== newStr && newStr !== "") {
            const label = fieldLabels[key] || key;
            if (oldStr === "") {
                changes.push(`Set ${label} to "${newStr}"`);
            } else {
                changes.push(`Changed ${label} from "${oldStr}" to "${newStr}"`);
            }
        }
    }

    return changes;
}
