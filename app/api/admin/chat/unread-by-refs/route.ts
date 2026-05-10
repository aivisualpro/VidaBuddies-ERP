import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaConversation from "@/lib/models/VidaConversation";
import { getSession } from "@/lib/auth";

/**
 * GET /api/admin/chat/unread-by-refs?kind=VBNumber
 *
 * Returns { [refId]: unreadCount } for the current user across
 * all "ref" conversations of the specified kind.
 */
export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const session = await getSession();
    if (!session?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const kind = new URL(req.url).searchParams.get("kind");
    if (!kind)
      return NextResponse.json(
        { error: "kind parameter required" },
        { status: 400 }
      );

    // Find all ref conversations of this kind
    const convos = await VidaConversation.find({
      kind: "ref",
      "refs.kind": kind,
    })
      .select("refs unreadBy")
      .lean();

    const result: Record<string, number> = {};

    for (const convo of convos) {
      const ref = (convo as any).refs?.find((r: any) => r.kind === kind);
      if (!ref) continue;

      const unreadMap = (convo as any).unreadBy;
      let unread = 0;
      if (unreadMap instanceof Map) {
        unread = unreadMap.get(session.id) || 0;
      } else if (unreadMap && typeof unreadMap === "object") {
        unread = unreadMap[session.id] || 0;
      }

      if (unread > 0) {
        result[ref.refId] = unread;
      }
    }

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
