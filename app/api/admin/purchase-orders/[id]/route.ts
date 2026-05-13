
import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaPO from "@/lib/models/VidaPO";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const item = await VidaPO.findById(id);

    if (!item) {
      return NextResponse.json(
        { error: "Purchase Order not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error("Failed to fetch purchase order:", error);
    return NextResponse.json(
      { error: "Failed to fetch purchase order" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request, { params }: RouteParams) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const data = await req.json();

    // Get original document to detect changes
    const originalDoc = await VidaPO.findById(id);
    if (!originalDoc) {
      return NextResponse.json(
        { error: "Purchase Order not found" },
        { status: 404 }
      );
    }

    const vbNumberId = originalDoc._id; // ObjectId for timeline refs

    // vbpoNo is deprecated — strip from incoming data AND remove from DB
    delete data.vbpoNo;
    // Also strip internal fields that shouldn't be sent back
    delete data._id;
    delete data.__v;

    // Separate MongoDB update operators ($push, $pull, etc.) from plain fields
    const updateOp: Record<string, any> = {};
    const plainFields: Record<string, any> = {};
    for (const key of Object.keys(data)) {
      if (key.startsWith("$")) {
        updateOp[key] = data[key];
      } else {
        plainFields[key] = data[key];
      }
    }

    // Plain fields (including dot-notation) go into $set
    if (Object.keys(plainFields).length > 0) {
      updateOp.$set = plainFields;
    }

    // Remove deprecated vbpoNo if it exists on the document
    if (originalDoc.toObject().hasOwnProperty("vbpoNo")) {
      if (!updateOp.$unset) updateOp.$unset = {};
      updateOp.$unset.vbpoNo = "";
    }

    const updatedItem = await VidaPO.findByIdAndUpdate(id, updateOp, {
      new: true,
      runValidators: true,
    });




    if (!updatedItem) {
      return NextResponse.json(
        { error: "Purchase Order not found" },
        { status: 404 }
      );
    }

    // --- Auto-log changes to timeline ---
    try {
      const logs: { comments: string; type: string; category?: string; cpoId?: string; shipId?: string }[] = [];

      // Detect shipping status changes via dot notation (e.g. customerPO.0.shipping.1.status)
      for (const key of Object.keys(data)) {
        const match = key.match(/^customerPO\.(\d+)\.shipping\.(\d+)\.(.+)$/);
        if (match) {
          const [, cpoIdx, shipIdx, field] = match;
          const oldShip = originalDoc.customerPO?.[Number(cpoIdx)]?.shipping?.[Number(shipIdx)];
          const poNo = originalDoc.customerPO?.[Number(cpoIdx)]?.poNo;
          const svbid = oldShip?.svbid;

          if (field === "status" && oldShip) {
            const oldStatus = oldShip.status || "Pending";
            const newStatus = data[key];
            if (oldStatus !== newStatus) {
              logs.push({
                comments: `Shipping status changed from "${oldStatus}" to "${newStatus}"`,
                type: "Shipping",
                category: "Shipping",
                cpoId: originalDoc.customerPO?.[Number(cpoIdx)]?._id?.toString(),
                shipId: oldShip?._id?.toString(),
              });
            }
          } else if (oldShip) {
            const FIELD_LABELS: Record<string, string> = {
              carrier: "Carrier", containerNo: "Container No", ETA: "ETA",
              updatedETA: "Updated ETA", portOfLading: "Port of Lading",
              portOfEntryShipTo: "Port of Entry", supplierPO: "Supplier PO",
              BOLNumber: "BOL Number", carrierBookingRef: "Booking Ref",
            };
            const label = FIELD_LABELS[field] || field;
            const oldVal = (oldShip as any)[field];
            const newVal = data[key];
            if (String(oldVal || "") !== String(newVal || "") && newVal) {
              logs.push({
                comments: oldVal
                  ? `Changed ${label} from "${oldVal}" to "${newVal}"`
                  : `Set ${label} to "${newVal}"`,
                type: "Notes",
                cpoId: originalDoc.customerPO?.[Number(cpoIdx)]?._id?.toString(),
                shipId: oldShip?._id?.toString(),
              });
            }
          }
        }

        // Detect CPO-level field changes (e.g. customerPO.0.status)
        const cpoMatch = key.match(/^customerPO\.(\d+)\.([^.]+)$/);
        if (cpoMatch) {
          const [, cpoIdx, field] = cpoMatch;
          const poNo = originalDoc.customerPO?.[Number(cpoIdx)]?.poNo;
          const oldVal = (originalDoc.customerPO?.[Number(cpoIdx)] as any)?.[field];
          const newVal = data[key];
          if (String(oldVal || "") !== String(newVal || "") && newVal && !["_id"].includes(field)) {
            logs.push({
              comments: oldVal
                ? `Changed ${field} from "${oldVal}" to "${newVal}" on ${poNo}`
                : `Set ${field} to "${newVal}" on ${poNo}`,
              type: "Notes",
              cpoId: originalDoc.customerPO?.[Number(cpoIdx)]?._id?.toString(),
            });
          }
        }
      }

      // Detect $push operations (new CPO or shipping added)
      if (data.$push) {
        if (data.$push.customerPO) {
          const newCpo = data.$push.customerPO;
          logs.push({
            comments: `New Customer PO "${newCpo.poNo}" added`,
            type: "Action Required",
            category: "Customer PO Added",
            cpoId: newCpo._id?.toString(),
          });
        }
      }

      // Detect direct orderType/category changes
      if (data.orderType && data.orderType !== originalDoc.orderType) {
        logs.push({ comments: `Order type changed from "${originalDoc.orderType}" to "${data.orderType}"`, type: "Notes" });
      }
      if (data.category && data.category !== originalDoc.category) {
        logs.push({ comments: `Category changed from "${originalDoc.category}" to "${data.category}"`, type: "Notes" });
      }

      // Write all logs
      if (logs.length > 0) {
        const { createTimelineLog } = await import("@/lib/timeline-logger");
        for (const log of logs) {
          await createTimelineLog({
            VBNumber: vbNumberId.toString(),
            VBSerialNumber: log.cpoId,
            VBShipmentNumber: log.shipId,
            type: log.type as any,
            category: log.category,
            comments: log.comments,
            status: "Closed",
            createdBy: "System",
          });
        }
      }
    } catch (logErr) {
      console.error("Timeline auto-log failed (non-blocking):", logErr);
    }

    return NextResponse.json(updatedItem);
  } catch (error: any) {
    console.error("Failed to update purchase order:", error);
    // Duplicate VBNumber
    if (error?.code === 11000) {
      const dupVal = error?.keyValue?.VBNumber || "unknown";
      return NextResponse.json(
        { error: `VB Number "${dupVal}" already exists on another PO` },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update purchase order" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    await connectToDatabase();
    const { id } = await params;
    const deletedItem = await VidaPO.findByIdAndDelete(id);

    if (!deletedItem) {
      return NextResponse.json(
        { error: "Purchase Order not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "Purchase Order deleted successfully" });
  } catch (error) {
    console.error("Failed to delete purchase order:", error);
    return NextResponse.json(
      { error: "Failed to delete purchase order" },
      { status: 500 }
    );
  }
}
