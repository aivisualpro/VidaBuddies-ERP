import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import EmailAutomation from "@/lib/models/EmailAutomation";
import { sendShipmentStatusNow } from "@/lib/email/shipment-status-sender";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/admin/email-automations/send-now
 * Body: { containerNo, recipients: string[] } — sends the shipment status
 * snapshot email immediately (independent of any schedule).
 * If an automationId is provided instead of recipients, that automation's
 * recipient list is used and its lastSentAt updated.
 */
export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const { containerNo, recipients, automationId } = await req.json();

    if (!containerNo) {
      return NextResponse.json({ error: "containerNo is required" }, { status: 400 });
    }

    let emails: string[] = [];
    let automation: any = null;

    if (automationId) {
      automation = await EmailAutomation.findById(automationId).lean();
      if (!automation) return NextResponse.json({ error: "Automation not found" }, { status: 404 });
      emails = automation.recipients || [];
    } else {
      emails = Array.isArray(recipients)
        ? [...new Set(recipients.map((e: string) => String(e).trim().toLowerCase()).filter(Boolean))]
        : [];
    }

    if (emails.length === 0 || emails.some((e) => !EMAIL_RE.test(e))) {
      return NextResponse.json({ error: "One or more recipient emails are invalid" }, { status: 400 });
    }

    const result = await sendShipmentStatusNow(containerNo, emails);
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to send" }, { status: 500 });
    }

    if (automation) {
      await EmailAutomation.updateOne(
        { _id: automation._id },
        { $set: { lastSentAt: new Date() } }
      );
    }

    return NextResponse.json({
      success: true,
      sentTo: emails,
      delivered: result.delivered || false,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
