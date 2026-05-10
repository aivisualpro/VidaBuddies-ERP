import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import { getSession } from "@/lib/auth";
import VidaConversation from "@/lib/models/VidaConversation";
import VidaMessage from "@/lib/models/VidaMessage";

/**
 * GET /api/admin/chat/conversations
 *
 * Returns the current user's conversations split into:
 *   - groups.byVBNumber  → three-level tree for "ref" conversations
 *   - dms                → direct-message conversations
 *   - mentionsCount      → total messages where user is @mentioned
 *   - users              → active user directory (for @mentions)
 */
export async function GET() {
  try {
    await connectToDatabase();
    const session = await getSession();
    if (!session?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = session.id;

    // ── Fetch all conversations the user participates in ──
    const convos = await VidaConversation.find({ participants: userId })
      .populate("participants", "name profilePicture isActive email")
      .populate("lastMessageBy", "name")
      .sort({ lastMessageAt: -1 })
      .lean();

    // ── Build ConvSummary shape ──
    const toSummary = (c: any) => ({
      _id: c._id?.toString(),
      name: c.name || "",
      kind: c.kind || "dm",
      lastMessage: c.lastMessage || "",
      lastMessageAt: c.lastMessageAt || c.updatedAt || "",
      unread: c.unreadBy?.[userId] || 0,
      refs: (c.refs || []).map((r: any) => ({
        kind: r.kind,
        refId: r.refId,
        display: r.display || r.refId,
      })),
      participants: c.participants,
      icon: c.icon || "",
      lastMessageBy: c.lastMessageBy,
    });

    // ── Split: DMs vs ref conversations ──
    const dms: any[] = [];
    const refConvos: any[] = [];

    for (const c of convos) {
      const summary = toSummary(c);
      if (c.kind === "ref" && c.refs?.length) {
        refConvos.push(summary);
      } else if (c.kind === "dm") {
        dms.push(summary);
      } else {
        // group conversations go into DMs section for now
        dms.push(summary);
      }
    }

    // ── Build three-level tree from ref conversations ──
    // Level-1: VBNumber → Level-2: VBSerialNumber → Level-3: VBShipmentNumber
    interface ShipLeaf {
      display: string;
      conversations: any[];
    }
    interface SerialNode {
      display: string;
      conversations: any[];
      byShipment: Record<string, ShipLeaf>;
    }
    interface VBNode {
      display: string;
      conversations: any[];
      bySerial: Record<string, SerialNode>;
    }
    const byVBNumber: Record<string, VBNode> = {};

    for (const conv of refConvos) {
      for (const ref of conv.refs) {
        if (ref.kind === "VBNumber") {
          if (!byVBNumber[ref.refId]) {
            byVBNumber[ref.refId] = {
              display: ref.display || ref.refId,
              conversations: [],
              bySerial: {},
            };
          }
          byVBNumber[ref.refId].conversations.push(conv);
        }
      }
    }

    // Nest VBSerialNumber under their parent VBNumber
    for (const conv of refConvos) {
      const serialRef = conv.refs.find((r: any) => r.kind === "VBSerialNumber");
      const vbRef = conv.refs.find((r: any) => r.kind === "VBNumber");
      if (serialRef && vbRef && byVBNumber[vbRef.refId]) {
        const parent = byVBNumber[vbRef.refId];
        if (!parent.bySerial[serialRef.refId]) {
          parent.bySerial[serialRef.refId] = {
            display: serialRef.display || serialRef.refId,
            conversations: [],
            byShipment: {},
          };
        }
        parent.bySerial[serialRef.refId].conversations.push(conv);
      }
    }

    // Nest VBShipmentNumber under their parent VBSerialNumber
    for (const conv of refConvos) {
      const shipRef = conv.refs.find(
        (r: any) => r.kind === "VBShipmentNumber"
      );
      const serialRef = conv.refs.find(
        (r: any) => r.kind === "VBSerialNumber"
      );
      const vbRef = conv.refs.find((r: any) => r.kind === "VBNumber");
      if (
        shipRef &&
        serialRef &&
        vbRef &&
        byVBNumber[vbRef.refId]?.bySerial?.[serialRef.refId]
      ) {
        const serialNode = byVBNumber[vbRef.refId].bySerial[serialRef.refId];
        if (!serialNode.byShipment[shipRef.refId]) {
          serialNode.byShipment[shipRef.refId] = {
            display: shipRef.display || shipRef.refId,
            conversations: [],
          };
        }
        serialNode.byShipment[shipRef.refId].conversations.push(conv);
      }
    }

    // ── Mentions count ──
    const mentionsCount = await VidaMessage.countDocuments({
      "mentions.userId": userId,
      deletedAt: { $exists: false },
    });

    return NextResponse.json({
      groups: { byVBNumber },
      dms,
      mentionsCount,
      currentUser: {
        id: session.id,
        name: session.name,
        email: session.email,
      },
    });
  } catch (error: any) {
    console.error("[Chat Conversations API]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
