import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import EmailAutomation from "@/lib/models/EmailAutomation";
import { getSession } from "@/lib/auth";
import { buildTrackingUrl } from "@/lib/tracking-token";
import mongoose from "mongoose";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** GET /api/admin/email-automations?containerNo=XYZ — list automations */
export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const containerNo = req.nextUrl.searchParams.get("containerNo");
    const filter: any = {};
    if (containerNo) filter.containerNo = containerNo;
    const automations = await EmailAutomation.find(filter).sort({ createdAt: -1 }).lean();
    return NextResponse.json({
      automations,
      // Secure public tracker link for this container (shareable with clients)
      trackUrl: containerNo ? buildTrackingUrl(containerNo) : undefined,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** POST — create an automation */
export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const { containerNo, shippingId, recipients, frequencyDays, sendTime, timezone } = body;

    if (!containerNo) {
      return NextResponse.json({ error: "containerNo is required" }, { status: 400 });
    }
    const emails: string[] = Array.isArray(recipients)
      ? [...new Set(recipients.map((e: string) => String(e).trim().toLowerCase()).filter(Boolean))]
      : [];
    if (emails.length === 0 || emails.some((e) => !EMAIL_RE.test(e))) {
      return NextResponse.json({ error: "One or more recipient emails are invalid" }, { status: 400 });
    }
    if (![1, 2, 3].includes(Number(frequencyDays))) {
      return NextResponse.json({ error: "frequencyDays must be 1, 2 or 3" }, { status: 400 });
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(sendTime || "")) {
      return NextResponse.json({ error: "sendTime must be HH:mm (24h)" }, { status: 400 });
    }
    // Validate the IANA timezone
    try {
      new Intl.DateTimeFormat("en-CA", { timeZone: timezone });
    } catch {
      return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
    }

    const session = await getSession().catch(() => null);

    const automation = await EmailAutomation.create({
      containerNo,
      shippingId:
        shippingId && /^[a-f0-9]{24}$/i.test(shippingId)
          ? new mongoose.Types.ObjectId(shippingId)
          : null,
      recipients: emails,
      frequencyDays: Number(frequencyDays) as 1 | 2 | 3,
      sendTime,
      timezone,
      active: true,
      createdBy: session?.email || "",
    });

    return NextResponse.json({ automation }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** PUT — update (toggle active, edit schedule/recipients) */
export async function PUT(req: NextRequest) {
  try {
    await connectToDatabase();
    const { id, updates } = await req.json();
    if (!id || !updates) {
      return NextResponse.json({ error: "id and updates are required" }, { status: 400 });
    }
    const allowed: any = {};
    if (typeof updates.active === "boolean") allowed.active = updates.active;
    if ([1, 2, 3].includes(Number(updates.frequencyDays))) allowed.frequencyDays = Number(updates.frequencyDays);
    if (typeof updates.sendTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(updates.sendTime)) allowed.sendTime = updates.sendTime;
    if (typeof updates.timezone === "string") allowed.timezone = updates.timezone;
    if (Array.isArray(updates.recipients)) {
      const emails = [...new Set(updates.recipients.map((e: string) => String(e).trim().toLowerCase()).filter(Boolean))];
      if (emails.length === 0 || emails.some((e) => !EMAIL_RE.test(e as string))) {
        return NextResponse.json({ error: "Invalid recipient emails" }, { status: 400 });
      }
      allowed.recipients = emails;
    }

    const automation = await EmailAutomation.findByIdAndUpdate(id, { $set: allowed }, { new: true }).lean();
    if (!automation) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ automation });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/** DELETE — remove an automation */
export async function DELETE(req: NextRequest) {
  try {
    await connectToDatabase();
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    await EmailAutomation.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
