import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import VidaSupplier from "@/lib/models/VidaSupplier";
import VidaSupplierSpec from "@/lib/models/VidaSupplierSpec";
import VidaProduct from "@/lib/models/VidaProduct";
import { uploadFile, findOrCreateFolder } from "@/lib/google-drive";
// @ts-ignore
import pdfParse from "pdf-parse";

function extractSpecData(text: string) {
  const lines = text.split('\n');
  let lastFieldIndex = -1;

  const getLineAfter = (keyword: RegExp) => {
    for (let i = 0; i < lines.length; i++) {
      if (keyword.test(lines[i])) {
        const match = lines[i].match(keyword);
        if (!match) continue;
        
        let val = lines[i].substring(match.index! + match[0].length).trim();
        lastFieldIndex = Math.max(lastFieldIndex, i);

        if (i + 1 < lines.length && !/^[A-Z0-9\s]+:/.test(lines[i+1]) && lines[i+1].trim() !== '') {
            val += " " + lines[i+1].trim();
            lastFieldIndex = Math.max(lastFieldIndex, i + 1);
        }
        return val;
      }
    }
    return "";
  };
  
  const extracted = [
    { key: "Product", value: getLineAfter(/PRODUCT:?\s*/i) },
    { key: "Brix: Acid Ratio", value: getLineAfter(/BRIX:\s*Acid Ratio:?\s*/i) },
    { key: "Brix", value: getLineAfter(/BRIX:?\s*(?!Acid Ratio)/i) },
    { key: "Color", value: getLineAfter(/COLOR:?\s*/i) },
    { key: "Flavor", value: getLineAfter(/FLAVOR:?\s*/i) },
    { key: "Absence of Defects", value: getLineAfter(/ABSENCE OF DEFECTS:?\s*/i) },
    { key: "Free & Suspended Pulp", value: getLineAfter(/FREE AND SUSPENDED PULP:?\s*/i) },
    { key: "Foreign Material", value: getLineAfter(/FOREIGN MATERIAL:?\s*/i) },
    { key: "Microbiological", value: getLineAfter(/MICROBIOLOGICAL:?\s*/i) },
    { key: "Container Size", value: getLineAfter(/CONTAINER SIZE:?\s*/i) },
    { key: "Net Weight", value: getLineAfter(/NET WEIGHT:?\s*/i) }
  ];

  let validExtracted = extracted.filter(item => item.value !== "");

  // Capture all remaining descriptive text at the bottom
  if (lastFieldIndex !== -1 && lastFieldIndex + 1 < lines.length) {
    const remainingLines = lines.slice(lastFieldIndex + 1).map(l => l.trim()).filter(l => l.length > 0);
    // Filter out potential footer junk like page numbers
    const cleanDescLines = remainingLines.filter(l => l.length > 5);
    if (cleanDescLines.length > 0) {
      validExtracted.push({ key: "Description", value: cleanDescLines.join(' ') });
    }
  }

  return validExtracted;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    await connectToDatabase();
    
    // Ensure Product model is initialized since we are populating
    if (!VidaProduct) {
      console.warn("Product model not initialized");
    }

    const specs = await VidaSupplierSpec.find({ supplierId: id })
      .populate('products', 'name vbId')
      .sort({ uploadedAt: -1 });

    return NextResponse.json(specs);
  } catch (error) {
    console.error("Specs GET error:", error);
    return NextResponse.json({ error: "Failed to fetch specs" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const name = formData.get("name") as string;
    const productsJson = formData.get("products") as string; // Will pass JSON string of IDs

    if (!file || !name) {
      return NextResponse.json({ error: "File and Name are required" }, { status: 400 });
    }

    let productIds: string[] = [];
    if (productsJson) {
      try {
        productIds = JSON.parse(productsJson);
      } catch (e) {
        console.error("Failed to parse products Array");
      }
    }

    await connectToDatabase();
    const supplier = await VidaSupplier.findById(id);
    if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

    const rootId = process.env.GOOGLE_DRIVE_FOLDERID || "";
    if (!rootId) return NextResponse.json({ error: "Google Drive integration disabled - missing GOOGLE_DRIVE_FOLDERID" }, { status: 500 });

    const folderName = `${supplier.name} (${supplier.vbId || supplier._id.toString().substring(0, 6)})`;
    const folderId = await findOrCreateFolder(rootId, folderName);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const uploadedFile = await uploadFile(folderId, file.name, file.type, buffer);

    let extractedData: { key: string; value: string }[] = [];
    if (file.type === 'application/pdf') {
      try {
        const pdfData = await pdfParse(buffer);
        extractedData = extractSpecData(pdfData.text);
      } catch (parseError) {
        console.error("Failed to parse PDF:", parseError);
      }
    }

    const newSpec = new VidaSupplierSpec({
      supplierId: id,
      name,
      products: productIds,
      pdfUrl: uploadedFile.webViewLink,
      pdfFileId: uploadedFile.id,
      fileName: file.name,
      extractedData
    });

    await newSpec.save();
    
    // Return populated
    const populatedObj = await VidaSupplierSpec.findById(newSpec._id).populate('products', 'name vbId');

    return NextResponse.json(populatedObj);
  } catch (error) {
    console.error("Specs POST error:", error);
    return NextResponse.json({ error: "Failed to upload spec document" }, { status: 500 });
  }
}
