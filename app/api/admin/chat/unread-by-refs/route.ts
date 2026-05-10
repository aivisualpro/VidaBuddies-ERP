import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaConversation from "@/lib/models/VidaConversation";
import { getSession } from "@/lib/auth";

/**
 * GET /api/admin/chat/unread-by-refs?kind=VBNumber
 * GET /api/admin/chat/unread-by-refs?kind=VBSerialNumber
 * GET /api/admin/chat/unread-by-refs?kind=VBShipmentNumber
 * GET /api/admin/chat/unread-by-refs?kind=VBSerialNumber&includeParent=VBNumber
 *
 * Returns { [refId]: { unread, hasConversation } } for the current user across
 * all "ref" conversations of the specified kind(s).
 *
 * When `includeParent` is set, also aggregates conversations that have
 * refs of the parent kind, mapping them to child IDs via `parentMap` (see below).
 */
export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const session = await getSession();
    if (!session?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const kind = url.searchParams.get("kind");
    if (!kind)
      return NextResponse.json(
        { error: "kind parameter required" },
        { status: 400 }
      );

    // Collect all ref kinds to search for
    const kinds = [kind];
    const includeParent = url.searchParams.get("includeParent");
    if (includeParent) kinds.push(includeParent);

    // Find all ref conversations matching any of these kinds
    const convos = await VidaConversation.find({
      kind: "ref",
      "refs.kind": { $in: kinds },
    })
      .select("refs unreadBy lastMessage lastMessageAt")
      .lean();

    const result: Record<string, { unread: number; hasConversation: boolean }> = {};

    for (const convo of convos) {
      const refs = (convo as any).refs || [];
      const unreadMap = (convo as any).unreadBy;
      const hasMessages = !!(convo as any).lastMessage;

      let unread = 0;
      if (unreadMap instanceof Map) {
        unread = unreadMap.get(session.id) || 0;
      } else if (unreadMap && typeof unreadMap === "object") {
        unread = unreadMap[session.id] || 0;
      }

      // Map each ref in this conversation
      for (const ref of refs) {
        if (kinds.includes(ref.kind)) {
          const key = ref.refId;
          if (!result[key]) {
            result[key] = { unread: 0, hasConversation: false };
          }
          result[key].unread += unread;
          if (hasMessages) result[key].hasConversation = true;
        }
      }
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
