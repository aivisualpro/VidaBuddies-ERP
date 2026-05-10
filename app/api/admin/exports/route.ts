import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VBshipping from "@/lib/models/VBshipping";
import VBcustomerPO from "@/lib/models/VBcustomerPO";
import VidaPO from "@/lib/models/VidaPO";

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const collection = searchParams.get("collection");

    if (!collection) {
      return NextResponse.json({ error: "collection param required" }, { status: 400 });
    }

    let data: any[] = [];

    switch (collection) {
      case "vbshippings":
        data = await VBshipping.find({}).lean();
        break;
      case "vbcustomerpos":
        data = await VBcustomerPO.find({}).lean();
        break;
      case "vidapos":
        data = await VidaPO.find({}).lean();
        break;
      default:
        return NextResponse.json({ error: "Invalid collection" }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
