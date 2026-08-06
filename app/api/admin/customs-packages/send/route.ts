import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/db";
import CustomsPackage from "@/lib/models/CustomsPackage";
import VBshipping from "@/lib/models/VBshipping";
import { sendMail } from "@/lib/email/send";
import {
  emailSubjectFor,
  readyToSendBlockers,
  routeSummary,
  PACKAGE_TYPE_LABELS,
  type CustomsRoute,
  type PackageType,
  type FsvpStatus,
} from "@/lib/customs/rules";

/**
 * POST /api/admin/customs-packages/send
 * { packageId, to: string[], note?, user? }
 *
 * Sends the broker package email (summary + Drive links + generated package
 * links). Enforces Ready-to-Send blockers server-side (PARS/PAPS + POE for
 * truck, FSVP/Prior Notice for U.S. food) — the spec's hard control.
 * Records send evidence and freezes the package version (SENT).
 */

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const { packageId, to, note, user } = await req.json();
    if (!packageId) return NextResponse.json({ error: "packageId required" }, { status: 400 });
    const recipients: string[] = (to || []).filter((e: string) => /.+@.+\..+/.test(e));
    if (recipients.length === 0) return NextResponse.json({ error: "At least one valid recipient is required" }, { status: 400 });

    const pkg: any = await CustomsPackage.findById(packageId);
    if (!pkg) return NextResponse.json({ error: "Package not found" }, { status: 404 });

    // ── Hard control: blockers stop the send ──
    const route: CustomsRoute = pkg.route;
    const criticalMissing = pkg.documents
      .filter((d: any) => ["CRITICAL", "TRUCK_BLOCKER", "OCEAN_CRITICAL"].includes(d.readiness) && d.state !== "RECEIVED" && d.state !== "NOT_APPLICABLE")
      .map((d: any) => d.label);
    const blockers = readyToSendBlockers({
      route,
      parsNumber: pkg.compliance?.parsNumber,
      papsNumber: pkg.compliance?.papsNumber,
      portOfEntry: pkg.compliance?.portOfEntry,
      fsvpStatus: pkg.compliance?.fsvpStatus as FsvpStatus,
      fsvpDuns: pkg.compliance?.fsvpDuns,
      isFood: pkg.compliance?.isFood,
      priorNoticeResponsible: pkg.compliance?.priorNoticeResponsible,
      criticalDocsMissing: criticalMissing,
    });
    if (blockers.length > 0) {
      return NextResponse.json({ error: "Package is not Ready to Send", blockers }, { status: 422 });
    }

    const primaryType = (pkg.packageTypes?.[0] || "CA_ENTRY") as PackageType;
    const hbl = pkg.fields?.find((f: any) => f.key === "bolNumber")?.value || "";
    const subject = emailSubjectFor(primaryType, {
      shipNumber: pkg.shipNumber,
      pars: pkg.compliance?.parsNumber,
      paps: pkg.compliance?.papsNumber,
      poe: pkg.compliance?.portOfEntry,
      hbl,
      etd: pkg.etd ? new Date(pkg.etd).toISOString().slice(0, 10) : "",
      version: pkg.version,
    });

    // ── Build the email ──
    const fieldVal = (key: string) => esc(pkg.fields?.find((f: any) => f.key === key)?.value || "—");
    const fmt = (d?: Date) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");
    const includedDocs = pkg.documents.filter((d: any) => d.included && d.fileId);
    const extraIncluded = (pkg.extraFiles || []).filter((f: any) => f.included);
    const generated = pkg.generated || [];

    const row = (l: string, v: string) =>
      `<tr><td style="padding:5px 12px 5px 0;color:#64748b;font-size:12px;white-space:nowrap;">${l}</td><td style="padding:5px 0;color:#0f172a;font-size:12px;font-weight:600;">${v}</td></tr>`;
    const docLine = (name: string, link?: string, sub?: string) =>
      `<li style="margin:4px 0;font-size:12px;color:#0f172a;">${
        link ? `<a href="${esc(link)}" style="color:#1d4ed8;text-decoration:none;">${esc(name)}</a>` : esc(name)
      }${sub ? ` <span style="color:#94a3b8;">— ${esc(sub)}</span>` : ""}</li>`;

    const html = `
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
  <div style="background:#0f172a;padding:18px 24px;">
    <div style="color:#f59e0b;font-size:11px;font-weight:800;letter-spacing:2px;">VIDA BUDDIES INC.</div>
    <div style="color:#ffffff;font-size:18px;font-weight:700;margin-top:2px;">Customs Package — ${esc(pkg.shipNumber)} (v${pkg.version})</div>
    <div style="color:#94a3b8;font-size:12px;margin-top:4px;">${esc(PACKAGE_TYPE_LABELS[primaryType] || primaryType)}</div>
  </div>
  <div style="padding:20px 24px;">
    <p style="font-size:13px;color:#334155;margin:0 0 14px;">${esc(routeSummary(route))}</p>
    ${note ? `<p style="font-size:13px;color:#334155;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;">${esc(note)}</p>` : ""}
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:6px 0 14px;">
      ${row("Importer of record", esc(pkg.importerName || "Vida Buddies Inc."))}
      ${row("Container / BOL", `${fieldVal("containerNo")} / ${fieldVal("bolNumber")}`)}
      ${row("Vessel", fieldVal("vessel"))}
      ${row("Route", `${fieldVal("portOfLading")} → ${fieldVal("portOfArrival")}`)}
      ${row("Port of entry", esc(pkg.compliance?.portOfEntry || "—"))}
      ${pkg.compliance?.parsNumber ? row("PARS / CCN", esc(pkg.compliance.parsNumber)) : ""}
      ${pkg.compliance?.papsNumber ? row("PAPS / SCN", esc(pkg.compliance.papsNumber)) : ""}
      ${row("ETD / ETA", `${fmt(pkg.etd)} / ${fmt(pkg.eta)}`)}
      ${row("Product", fieldVal("product"))}
      ${row("Invoice value", fieldVal("invoiceValue"))}
    </table>
    ${
      generated.length
        ? `<div style="font-size:11px;font-weight:800;letter-spacing:1px;color:#94a3b8;margin:14px 0 6px;">GENERATED FORMS</div>
           <ul style="margin:0;padding-left:18px;">${generated.map((g: any) => docLine(g.fileName, g.webViewLink)).join("")}</ul>`
        : ""
    }
    <div style="font-size:11px;font-weight:800;letter-spacing:1px;color:#94a3b8;margin:14px 0 6px;">SOURCE DOCUMENTS (${includedDocs.length + extraIncluded.length})</div>
    <ul style="margin:0;padding-left:18px;">
      ${includedDocs.map((d: any) => docLine(d.fileName, d.webViewLink, d.label)).join("")}
      ${extraIncluded.map((f: any) => docLine(f.fileName, f.webViewLink)).join("")}
    </ul>
    <p style="font-size:12px;color:#64748b;margin:16px 0 0;">Please acknowledge receipt of this package. Reference <strong>${esc(pkg.shipNumber)}</strong> in all correspondence.</p>
  </div>
  <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:12px 24px;font-size:11px;color:#94a3b8;">
    Prepared with Vida Buddies ERP · Package v${pkg.version} · Ruleset ${esc(pkg.rulesetVersion || "")}
  </div>
</div>`;

    const text = [
      `VIDA BUDDIES INC. — Customs Package ${pkg.shipNumber} (v${pkg.version})`,
      routeSummary(route),
      `Container/BOL: ${pkg.fields?.find((f: any) => f.key === "containerNo")?.value || "—"} / ${hbl || "—"}`,
      `Port of entry: ${pkg.compliance?.portOfEntry || "—"}`,
      pkg.compliance?.parsNumber ? `PARS/CCN: ${pkg.compliance.parsNumber}` : "",
      pkg.compliance?.papsNumber ? `PAPS/SCN: ${pkg.compliance.papsNumber}` : "",
      `Documents: ${includedDocs.map((d: any) => d.fileName).join(", ")}`,
      `Please acknowledge receipt.`,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await sendMail({ to: recipients, subject, html, text });
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Send failed" }, { status: 500 });
    }

    pkg.sends.push({ at: new Date(), to: recipients, subject, messageId: result.messageId, packageVersion: pkg.version });
    pkg.status = "SENT";
    pkg.audit.push({ at: new Date(), user, action: "SENT_TO_BROKER", detail: `${recipients.join(", ")} — ${subject}` });
    await pkg.save();

    // Existing toggle: DOCS TO BROKER set only after a successful send (Appendix C)
    VBshipping.updateOne({ _id: pkg.shipmentId }, { $set: { isAllDocumentsProvidedToCustomsBroker: true } }).catch(() => {});

    return NextResponse.json({ success: true, messageId: result.messageId, subject });
  } catch (e: any) {
    console.error("[customs-packages/send]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
