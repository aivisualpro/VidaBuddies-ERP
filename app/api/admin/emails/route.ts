import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import EmailRecord from "@/lib/models/EmailRecord";
import mongoose from "mongoose";

/**
 * GET — List email records for a specific vbpoNo
 * Uses raw MongoDB to bypass Mongoose schema/model caching issues
 */
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const vbpoNo = request.nextUrl.searchParams.get("vbpoNo");

    if (!vbpoNo) {
      return NextResponse.json({ error: "vbpoNo is required" }, { status: 400 });
    }

    // Raw query ensures ALL fields (including 'reference') are returned
    const db = mongoose.connection.db;
    const emails = await db!
      .collection("emailrecords")
      .find({ vbpoNo })
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
