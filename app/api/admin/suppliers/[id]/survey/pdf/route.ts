import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import VidaSupplier from "@/lib/models/VidaSupplier";
import SurveyTemplate from "@/lib/models/SurveyTemplate";
// @ts-ignore
import { jsPDF } from "jspdf";
// @ts-ignore
import "jspdf-autotable";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const templateId = url.searchParams.get("templateId") || "qfs-manufacturing-survey";

    await connectToDatabase();

    const [supplier, template] = await Promise.all([
      VidaSupplier.findById(id).lean(),
      SurveyTemplate.findOne({ templateId }).lean(),
    ]);

    if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    const response = (supplier.surveyResponses as any[] || []).find(
      (r: any) => r.templateId === templateId
    );
    if (!response) return NextResponse.json({ error: "No survey response found" }, { status: 404 });

    const a = response.answers || {};
    const tpl = template as any;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = 15;
    let pageNum = 0;

    const addHeader = () => {
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(`Title: ${tpl.name.toUpperCase()}`, pageWidth / 2, 12, { align: "center" });
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text(`Doc. No.: ${tpl.docNo} | Rev. No.: ${tpl.revNo}`, pageWidth / 2, 17, { align: "center" });
      doc.setDrawColor(0);
      doc.line(margin, 20, pageWidth - margin, 20);
      return 25;
    };

    const addFooter = (pn: number) => {
      const ph = doc.internal.pageSize.getHeight();
      doc.setFontSize(6);
      doc.setFont("helvetica", "italic");
      doc.text("VIDA BUDDIES INC. Confidential", margin, ph - 8);
      doc.text(`Page ${pn} of ${tpl.pages.length}`, pageWidth - margin, ph - 8, { align: "right" });
      doc.text("All paper copies are uncontrolled.", pageWidth - margin, ph - 5, { align: "right" });
    };

    const checkPage = () => {
      if (y > 260) {
        addFooter(pageNum);
        doc.addPage();
        pageNum++;
        y = addHeader();
      }
    };

    // Render each template page
    for (let pi = 0; pi < tpl.pages.length; pi++) {
      if (pi > 0) {
        addFooter(pageNum);
        doc.addPage();
      }
      pageNum = pi + 1;
      y = addHeader();
      const page = tpl.pages[pi];

      for (const section of page.sections) {
        checkPage();
        // Section title
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(section.title, margin, y);
        y += 2;
        doc.line(margin, y, pageWidth - margin, y);
        y += 5;

        if (section.subtitle) {
          doc.setFontSize(7);
          doc.setFont("helvetica", "italic");
          const subLines = doc.splitTextToSize(section.subtitle, pageWidth - margin * 2);
          doc.text(subLines, margin, y);
          y += subLines.length * 3 + 2;
        }

        if (section.description) {
          doc.setFontSize(7);
          doc.setFont("helvetica", "normal");
          const descLines = doc.splitTextToSize(section.description, pageWidth - margin * 2);
          doc.text(descLines, margin, y);
          y += descLines.length * 3 + 3;
        }

        for (const field of section.fields) {
          checkPage();
          const val = a[field.key];

          switch (field.type) {
            case 'text':
            case 'date': {
              doc.setFontSize(8);
              doc.setFont("helvetica", "bold");
              doc.text(`${field.label}:`, margin, y);
              doc.setFont("helvetica", "normal");
              const labelW = Math.min(doc.getTextWidth(`${field.label}: `) + 2, 70);
              doc.text(String(val || "—"), margin + labelW, y);
              y += 6;
              break;
            }
            case 'textarea': {
              doc.setFontSize(8);
              doc.setFont("helvetica", "bold");
              doc.text(`${field.label}:`, margin, y);
              y += 5;
              doc.setFont("helvetica", "normal");
              if (val) {
                const lines = doc.splitTextToSize(String(val), pageWidth - margin * 2 - 5);
                doc.text(lines, margin + 5, y);
                y += lines.length * 4 + 2;
              } else {
                doc.text("—", margin + 5, y);
                y += 6;
              }
              break;
            }
            case 'radio': {
              doc.setFontSize(8);
              doc.setFont("helvetica", "normal");
              const qLines = doc.splitTextToSize(field.label, pageWidth - margin * 2);
              doc.text(qLines, margin, y);
              y += qLines.length * 4;
              doc.setFont("helvetica", "bold");
              doc.text(`Answer: ${val || "—"}`, margin + 5, y);
              y += 7;
              break;
            }
            case 'checklist': {
              const opts = field.options || [];
              opts.forEach((item: string, i: number) => {
                checkPage();
                const checked = val && val[i] ? "☑" : "☐";
                doc.setFontSize(7.5);
                doc.setFont("helvetica", "normal");
                const lines = doc.splitTextToSize(`${checked}  ${item}`, pageWidth - margin * 2 - 5);
                doc.text(lines, margin + 3, y);
                y += lines.length * 3.5 + 1;
              });
              y += 2;
              break;
            }
          }
        }
        y += 3;
      }
    }
    addFooter(pageNum);

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
    const safeName = (supplier.name || 'Supplier').replace(/\s+/g, '_');
    const fileName = `${tpl.name.replace(/\s+/g, '_')}_${safeName}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
