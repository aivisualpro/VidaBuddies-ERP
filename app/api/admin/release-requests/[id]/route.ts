import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaReleaseRequest from "@/lib/models/VidaReleaseRequest";
import VidaProduct from "@/lib/models/VidaProduct";
import VidaWarehouse from "@/lib/models/VidaWarehouse";
import VidaCustomer from "@/lib/models/VidaCustomer";
import VidaUser from "@/lib/models/VidaUser";
import VBcustomerPO from "@/lib/models/VBcustomerPO";
import VidaTransferOrder from "@/lib/models/VidaTransferOrder";
import VBshipping from "@/lib/models/VBshipping";
import { broadcastMutation } from "@/lib/pusher/broadcast";

// Ensure all populated models are registered (prevents tree-shaking in production)
const _models = { VidaProduct, VidaWarehouse, VidaCustomer, VidaUser, VBcustomerPO, VidaTransferOrder, VBshipping };

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const requestItem = await VidaReleaseRequest.findById(id)
      .populate("warehouse", "name")
      .populate("customer", "name location")
      .populate("requestedBy", "name email")
      // poNo is populated manually below to handle non-ObjectId values gracefully
      .populate("transferOrder", "VBShipmentNumber svbid")
      .populate({
        path: 'releaseOrderProducts.product',
        model: _models.VidaProduct.modelName,
        select: 'name vbId'
      })
      .lean();
      
    if (!requestItem) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Manually populate poNo to handle non-ObjectId values (e.g. "ZK052926-885")
    const item = requestItem as any;
    if (item.poNo) {
      const { Types } = await import("mongoose");
      if (Types.ObjectId.isValid(item.poNo) && String(new Types.ObjectId(item.poNo)) === String(item.poNo)) {
        const po = await _models.VBcustomerPO
          .findById(item.poNo)
          .select("customerPONo VBSerialNumber customer")
          .lean();
        if (po) item.poNo = po;
      }
    }

    return NextResponse.json(item);
  } catch (error: any) {
    console.error("Release Request GET [id] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    await connectToDatabase();
    const { id } = await params;

    // Check if this is a pickedUp transition (false → true)
    let wasPickedUp = false;
    if (body.pickedUp === true) {
      const before = await VidaReleaseRequest.findById(id).select("pickedUp").lean();
      wasPickedUp = !!before?.pickedUp;
    }
    
    const updated = await VidaReleaseRequest.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    })
      .populate("warehouse", "name")
      .populate("customer", "name location")
      .populate("requestedBy", "name email")
      // poNo is populated manually below to handle non-ObjectId values gracefully
      .populate("transferOrder", "VBShipmentNumber svbid")
      .populate({
        path: 'releaseOrderProducts.product',
        model: _models.VidaProduct.modelName,
        select: 'name vbId'
      })
      .lean();

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Manually populate poNo to handle non-ObjectId values
    const item = updated as any;
    if (item.poNo) {
      const { Types } = await import("mongoose");
      if (Types.ObjectId.isValid(item.poNo) && String(new Types.ObjectId(item.poNo)) === String(item.poNo)) {
        const po = await _models.VBcustomerPO
          .findById(item.poNo)
          .select("customerPONo VBSerialNumber customer")
          .lean();
        if (po) item.poNo = po;
      }
    }

    broadcastMutation("release-requests", "update", id);

    // ── Fire-and-forget: Send pickup notification email ──
    if (body.pickedUp === true && !wasPickedUp) {
      sendPickupNotification(item).catch(err =>
        console.error("[Release Request] Pickup notification failed:", err)
      );
    }

    return NextResponse.json(item);
  } catch (error: any) {
    console.error("Release Request PUT Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/* ─────────────────────────────────────────────
 *  Pickup Notification Email
 * ───────────────────────────────────────────── */
async function sendPickupNotification(release: any) {
  const nodemailer = (await import("nodemailer")).default;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.office365.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    requireTLS: true,
    tls: { minVersion: "TLSv1.2" },
  });

  // ── Build detail fields ──
  const customerName = release.customer?.name || "—";
  const warehouseName = release.warehouse?.name || "—";
  const requestedBy = release.requestedBy?.name || release.createdBy || "—";
  const shipmentNo = release.transferOrder?.VBShipmentNumber || release.transferOrder?.svbid || "—";
  const poNo = typeof release.poNo === "object"
    ? (release.poNo.customerPONo || release.poNo.VBSerialNumber || "—")
    : (release.poNo || "—");
  const releaseDate = release.date
    ? new Date(release.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
    : "—";
  const carrier = release.carrier || "—";
  const instructions = release.instructions || "None";
  const scheduledDate = release.scheduledPickupDate
    ? new Date(release.scheduledPickupDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
    : "—";
  const scheduledTime = release.scheduledPickupTime || "—";

  // Product table rows
  const products = (release.releaseOrderProducts || []).map((p: any) => {
    const name = typeof p.product === "object" ? (p.product?.name || p.product?.vbId || "—") : "—";
    return { name, qty: p.qty || 0, lot: p.lotSerial || "—" };
  });

  const productRows = products.map((p: any) =>
    `<tr>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#1a1a1a">${p.name}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#1a1a1a;text-align:center;font-weight:600">${p.qty}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#666;font-family:monospace">${p.lot}</td>
    </tr>`
  ).join("");

  const totalQty = products.reduce((s: number, p: any) => s + p.qty, 0);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f7f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;padding:32px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">

  <!-- Header -->
  <tr>
    <td style="background:#1a1a1a;padding:28px 32px">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <span style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#10b981">✓ Picked Up</span>
            <h1 style="margin:6px 0 0;font-size:22px;font-weight:600;color:#ffffff;line-height:1.3">Release #${shipmentNo}</h1>
          </td>
          <td align="right" valign="top">
            <span style="font-size:12px;color:#888">${releaseDate}</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Body -->
  <tr>
    <td style="padding:28px 32px 16px">
      <p style="margin:0 0 20px;font-size:15px;color:#333;line-height:1.6">
        A release request has been picked up from <strong>${warehouseName}</strong>.
        Here's a quick summary of what went out.
      </p>

      <!-- Info Grid -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
        <tr>
          <td width="50%" style="padding:0 8px 12px 0;vertical-align:top">
            <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#999">Customer</span>
            <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#1a1a1a">${customerName}</p>
          </td>
          <td width="50%" style="padding:0 0 12px 8px;vertical-align:top">
            <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#999">PO Number</span>
            <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#1a1a1a">${poNo}</p>
          </td>
        </tr>
        <tr>
          <td width="50%" style="padding:0 8px 12px 0;vertical-align:top">
            <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#999">Carrier</span>
            <p style="margin:4px 0 0;font-size:15px;color:#1a1a1a">${carrier}</p>
          </td>
          <td width="50%" style="padding:0 0 12px 8px;vertical-align:top">
            <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#999">Requested By</span>
            <p style="margin:4px 0 0;font-size:15px;color:#1a1a1a">${requestedBy}</p>
          </td>
        </tr>
        ${scheduledDate !== "—" ? `
        <tr>
          <td width="50%" style="padding:0 8px 12px 0;vertical-align:top">
            <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#999">Scheduled Pickup</span>
            <p style="margin:4px 0 0;font-size:15px;color:#1a1a1a">${scheduledDate}</p>
          </td>
          <td width="50%" style="padding:0 0 12px 8px;vertical-align:top">
            <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#999">Pickup Time</span>
            <p style="margin:4px 0 0;font-size:15px;color:#1a1a1a">${scheduledTime}</p>
          </td>
        </tr>` : ""}
      </table>

      <!-- Products Table -->
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;margin-bottom:20px">
        <thead>
          <tr style="background:#fafafa">
            <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#999;border-bottom:1px solid #eee">Product</th>
            <th style="padding:10px 14px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#999;border-bottom:1px solid #eee">Qty</th>
            <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#999;border-bottom:1px solid #eee">Lot / Serial</th>
          </tr>
        </thead>
        <tbody>
          ${productRows}
          <tr style="background:#fafafa">
            <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#1a1a1a">Total</td>
            <td style="padding:10px 14px;text-align:center;font-size:14px;font-weight:700;color:#1a1a1a">${totalQty}</td>
            <td style="padding:10px 14px"></td>
          </tr>
        </tbody>
      </table>

      ${instructions !== "None" ? `
      <!-- Instructions -->
      <div style="background:#f9fafb;border-left:3px solid #d1d5db;padding:12px 16px;border-radius:0 6px 6px 0;margin-bottom:20px">
        <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#999">Instructions</span>
        <p style="margin:4px 0 0;font-size:14px;color:#333;line-height:1.5">${instructions}</p>
      </div>` : ""}
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="padding:16px 32px 28px;border-top:1px solid #f0f0f0">
      <p style="margin:0;font-size:12px;color:#aaa;line-height:1.5">
        Vida Buddies ERP &nbsp;·&nbsp; Automated pickup notification
      </p>
    </td>
  </tr>

</table>
</td></tr></table>
</body>
</html>`;

  await transporter.sendMail({
    from: `"Vida Buddies" <${process.env.SMTP_USER}>`,
    to: "jozef@vidabuddies.com",
    subject: `Picked Up — ${shipmentNo} · ${customerName}`,
    html,
  });

  console.log(`[Release Request] Pickup notification sent for ${shipmentNo}`);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const deleted = await VidaReleaseRequest.findByIdAndDelete(id);
    
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    broadcastMutation("release-requests", "delete", id);

    return NextResponse.json({ message: "Deleted successfully" });
  } catch (error: any) {
    console.error("Release Request DELETE Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
