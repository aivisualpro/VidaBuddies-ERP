import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VBshipping from "@/lib/models/VBshipping";
import { renderShipmentStatusEmail } from "@/lib/email/templates/shipment-status";
import {
  buildShipmentEmailData,
  isDeliveredStatus,
  latestRawStatus,
} from "@/lib/email/shipment-status-sender";
import { publicAppUrl } from "@/lib/tracking-token";
import { ensureFreshTracking } from "@/lib/tracking-refresh";

/**
 * GET /api/admin/email-automations/preview?containerNo=XYZ
 *
 * Renders the exact HTML email that recipients would receive, using the
 * shipment's latest tracking data. Opened in a new tab from the Email
 * Automations dialog so you can see the email before sending it.
 */
export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const containerNo = req.nextUrl.searchParams.get("containerNo");
    if (!containerNo) {
      return NextResponse.json({ error: "containerNo is required" }, { status: 400 });
    }

    // Preview should show what a recipient would actually get — fresh data
    await ensureFreshTracking(containerNo);

    const ship = await VBshipping.findOne(
      { containerNo },
      { driveDocuments: 0, shippingTrackingRecords: { $slice: -1 } }
    ).lean();

    if (!ship) {
      return NextResponse.json(
        { error: `Shipment not found for container ${containerNo}` },
        { status: 404 }
      );
    }

    const delivered = isDeliveredStatus(latestRawStatus(ship));
    const data = buildShipmentEmailData(ship, publicAppUrl(), delivered);
    const { html } = renderShipmentStatusEmail(data);

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
