import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaTimeline from "@/lib/models/VidaTimeline";

/**
 * GET /api/dev/seed-reminders
 *
 * Dev-only route that inserts 5 fake VidaTimeline entries with
 * mixed statuses and reminder dates for testing the notification system.
 * Blocked in production.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 404 }
    );
  }

  await connectToDatabase();

  const now = new Date();

  const seedItems = [
    {
      type: "Action Required",
      comments: "Follow up with vendor on missing paperwork for container shipment. Need BOL and packing list.",
      status: "Open",
      category: "Documentation",
      reminder: new Date(now.getTime() - 4 * 3600000), // 4h ago — overdue
      timestamp: new Date(now.getTime() - 86400000 * 3),
      createdBy: "seed-script",
    },
    {
      type: "Shipping",
      comments: "Container MSKU-9921 expected at port today. Confirm customs clearance status with broker.",
      status: "In Progress",
      category: "Logistics",
      reminder: new Date(now.getTime() - 1 * 3600000), // 1h ago — overdue
      timestamp: new Date(now.getTime() - 86400000 * 2),
      createdBy: "seed-script",
    },
    {
      type: "Action Required",
      comments: "Quality inspection report pending for batch #2024-Q4-88. Lab results should be in today.",
      status: "Open",
      category: "QC",
      reminder: new Date(now.getTime() + 2 * 3600000), // 2h from now — due today
      timestamp: new Date(now.getTime() - 86400000),
      createdBy: "seed-script",
    },
    {
      type: "Notes",
      comments: "Supplier confirmed new pricing effective next month. Update cost sheets before next PO.",
      status: "Open",
      category: "Pricing",
      reminder: new Date(now.getTime() + 6 * 3600000), // 6h from now — due today
      timestamp: new Date(now.getTime() - 86400000 * 5),
      createdBy: "seed-script",
    },
    {
      type: "Action Required",
      comments: "Payment reminder: Invoice #INV-2024-1192 is due. Process wire transfer to supplier account.",
      status: "In Progress",
      category: "Finance",
      reminder: new Date(now.getTime() - 86400000 * 2), // 2 days ago — very overdue
      timestamp: new Date(now.getTime() - 86400000 * 7),
      createdBy: "seed-script",
    },
  ];

  const result = await VidaTimeline.insertMany(seedItems);

  return NextResponse.json({
    success: true,
    inserted: result.length,
    ids: result.map((r) => r._id.toString()),
    message: "Seeded 5 test timeline entries. Run cron:reminders to fan out notifications.",
  });
}
