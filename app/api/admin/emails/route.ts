import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import EmailRecord from "@/lib/models/EmailRecord";
import mongoose from "mongoose";

/**
 * GET — List email records for a specific VBNumber (PO ObjectId)
 * Accepts either ?VBNumber=... or legacy ?vbpoNo=... query param
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const rawId = request.nextUrl.searchParams.get("VBNumber") || request.nextUrl.searchParams.get("vbpoNo");

    if (!rawId) {
      return NextResponse.json({ error: "VBNumber is required" }, { status: 400 });
    }

    // Query by ObjectId if it looks like one, otherwise resolve display name
    let filter: any;
    if (/^[a-f0-9]{24}$/i.test(rawId)) {
      filter = { VBNumber: new mongoose.Types.ObjectId(rawId) };
    } else {
      // rawId is a display name like "VB300" — resolve to PO ObjectId
      const VidaPO = (await import("@/lib/models/VidaPO")).default;
      const po = await VidaPO.findOne({ VBNumber: rawId }, { _id: 1 }).lean();
      if (po) {
        filter = { VBNumber: po._id };
      } else {
        // Fallback: try matching as string (for legacy unresolved records)
        filter = { VBNumber: rawId };
      }
    }

    // Raw query ensures ALL fields (including 'reference') are returned
    const db = mongoose.connection.db;
    const emails = await db!
      .collection("emailrecords")
      .find(filter)
      .sort({ sentAt: -1 })
      .toArray();

    return NextResponse.json({ emails });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PUT — Update email record (type and/or reference)
 */
export async function PUT(request: NextRequest) {
  try {
    await connectToDatabase();
    const { id, type, reference } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const updateData: any = {};
    if (type !== undefined) updateData.type = String(type);
    if (reference !== undefined) updateData.reference = String(reference);

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "no update fields provided" }, { status: 400 });
    }

    // Use raw MongoDB to guarantee all fields are written regardless of schema cache
    const db = mongoose.connection.db;
    const { ObjectId } = require("mongodb");
    const result = await db!
      .collection("emailrecords")
      .findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updateData },
        { returnDocument: "after" }
      );

    if (!result) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, email: result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
