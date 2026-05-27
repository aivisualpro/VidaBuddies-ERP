import { NextResponse } from "next/server";
import {
  renderReminderEmail,
  type ReminderEmailItem,
} from "@/lib/email/templates/reminder";

/**
 * GET /api/dev/preview-email/reminder
 *
 * Dev-only route that renders the reminder email template with mock data
 * in the browser. Blocked in production.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 404 }
    );
  }

  const mockItems: ReminderEmailItem[] = [
    {
      title: "Reminder: Quality Check — PO-2024-0891",
      comments:
        "Please review the quality inspection report for the latest batch. The supplier noted minor color variations that need approval before shipment proceeds.",
      vbNumber: "VBP-0891",
      vbSerial: "VBS-4821",
      vbShipment: "MSKU-7234",
      reminder: new Date(Date.now() - 2 * 3600000), // 2h ago
      status: "Open",
      link: "/admin/active-actions",
    },
    {
      title: "Reminder: Shipping Confirmation",
      comments: "Container MSKU-7234 has departed port. Confirm estimated arrival date with the logistics team.",
      vbNumber: "VBP-1024",
      vbShipment: "MSKU-7234",
      reminder: new Date(), // now
      status: "In Progress",
      link: "/admin/active-actions",
    },
    {
      title: "Reminder: Invoice Follow-up",
      comments: "Outstanding invoice for serial #VBS-3392. Payment was due 5 days ago.",
      vbNumber: "VBP-0777",
      vbSerial: "VBS-3392",
      reminder: new Date(Date.now() - 5 * 86400000), // 5 days ago
      status: "Open",
      link: "/admin/active-actions",
    },
    {
      title: "Reminder: Supplier Response Pending",
      vbNumber: "VBP-1100",
      reminder: new Date(Date.now() + 4 * 3600000), // 4h from now
      status: "Open",
      link: "/admin/active-actions",
    },
  ];

  const appUrl = process.env.APP_URL || "http://localhost:1001";
  const { html } = renderReminderEmail({
    userName: "Adeel Jabbar",
    items: mockItems,
    appUrl,
  });

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
