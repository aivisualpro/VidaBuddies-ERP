import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import EmailRecord from "@/lib/models/EmailRecord";

/**
 * GET — List email records for a specific vbpoNo
 * ?vbpoNo=VB412
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const vbpoNo = request.nextUrl.searchParams.get("vbpoNo");

    if (!vbpoNo) {
      return NextResponse.json({ error: "vbpoNo is required" }, { status: 400 });
    }

    const emails = await EmailRecord.find({ vbpoNo })
      .sort({ sentAt: -1 })
      .lean();

    return NextResponse.json({ emails });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
