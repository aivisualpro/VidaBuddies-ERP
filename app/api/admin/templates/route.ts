import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import SurveyTemplate from "@/lib/models/SurveyTemplate";

export async function GET() {
  try {
    await connectToDatabase();
    const templates = await SurveyTemplate.find().lean();
    return NextResponse.json(templates);
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();
    
    const existing = await SurveyTemplate.findOne({ templateId: body.templateId });
    if (existing) {
      Object.assign(existing, body);
      await existing.save();
      return NextResponse.json(existing);
    }
    
    const template = await SurveyTemplate.create(body);
    return NextResponse.json(template);
  } catch (error) {
    console.error("Error saving template:", error);
    return NextResponse.json({ error: "Failed to save template" }, { status: 500 });
  }
}
