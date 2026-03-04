
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

    const vbpoNo = originalDoc.vbpoNo;

    const updatedItem = await VidaPO.findByIdAndUpdate(id, data, {
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
      const logs: { comments: string; type: string; category?: string; poNo?: string; svbid?: string }[] = [];

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
                type: "Shipping Status",
                category: "Shipping Status",
                poNo,
                svbid,
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
                poNo,
                svbid,
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
              poNo,
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
            poNo: newCpo.poNo,
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
            vbpoNo,
            poNo: log.poNo,
            svbid: log.svbid,
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
  } catch (error) {
    console.error("Failed to update purchase order:", error);
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
