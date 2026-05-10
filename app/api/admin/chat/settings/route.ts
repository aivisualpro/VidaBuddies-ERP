import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaUser from "@/lib/models/VidaUser";
import { getSession } from "@/lib/auth";

/**
 * GET /api/admin/chat/settings — returns current user's chat settings
 * POST /api/admin/chat/settings — updates chat settings
 */
export async function GET() {
  try {
    await connectToDatabase();
    const session = await getSession();
    if (!session?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await VidaUser.findById(session.id, "chatSettings").lean();
    const settings = (user as any)?.chatSettings || {
      notifyOn: "all",
      soundOn: true,
      emailOn: true,
    };

    return NextResponse.json(settings);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const session = await getSession();
    if (!session?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const update: any = {};

    if (body.notifyOn && ["all", "mentions", "none"].includes(body.notifyOn)) {
      update["chatSettings.notifyOn"] = body.notifyOn;
    }
    if (typeof body.soundOn === "boolean") {
      update["chatSettings.soundOn"] = body.soundOn;
    }
    if (typeof body.emailOn === "boolean") {
      update["chatSettings.emailOn"] = body.emailOn;
    }

    await VidaUser.findByIdAndUpdate(session.id, { $set: update });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
