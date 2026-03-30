import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaSupplier from "@/lib/models/VidaSupplier";

// GET survey response for a supplier
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectToDatabase();
    const supplier = await VidaSupplier.findById(id, 'surveyResponses name vbId manufacturingAddress country primaryContactName communicationEmail phone').lean();
    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }
    return NextResponse.json(supplier);
  } catch (error) {
    console.error("Error fetching survey:", error);
    return NextResponse.json({ error: "Failed to fetch survey data" }, { status: 500 });
  }
}

// POST/PUT survey response (save draft or submit)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectToDatabase();
    const body = await req.json();
    const { templateId, answers, status } = body;

    const supplier = await VidaSupplier.findById(id);
    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    if (!supplier.surveyResponses) {
      supplier.surveyResponses = [];
    }

    const existingIdx = supplier.surveyResponses.findIndex(
      (r: any) => r.templateId === templateId
    );

    const responseData: any = {
      templateId,
      answers,
      status: status || 'draft',
    };

    if (status === 'submitted') {
      responseData.submittedAt = new Date();
    }

    if (existingIdx >= 0) {
      // Update existing
      supplier.surveyResponses[existingIdx] = {
        ...supplier.surveyResponses[existingIdx],
        ...responseData,
      };
    } else {
      // Create new
      supplier.surveyResponses.push(responseData);
    }

    await supplier.save();

    return NextResponse.json({ success: true, surveyResponses: supplier.surveyResponses });
  } catch (error) {
    console.error("Error saving survey:", error);
    return NextResponse.json({ error: "Failed to save survey" }, { status: 500 });
  }
}
