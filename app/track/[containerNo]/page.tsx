import type { Metadata } from "next";
import connectToDatabase from "@/lib/db";
import VBshipping from "@/lib/models/VBshipping";
import { verifyTrackingToken } from "@/lib/tracking-token";
import {
  buildShipmentEmailData,
  isDeliveredStatus,
  latestRawStatus,
  parseRawJson,
} from "@/lib/email/shipment-status-sender";
import { publicAppUrl } from "@/lib/tracking-token";
import { PublicTrackingView, type PublicTrackingData } from "@/components/track/public-tracking-view";

/**
 * PUBLIC shipment tracking page for external people (clients).
 *
 * URL: /track/[containerNo]?t=<signed-token>
 * The token is an HMAC signature (see lib/tracking-token.ts) — the link from
 * the shipment email "just works" with no login, but can't be guessed and
 * only ever exposes read-only tracking data for that single container.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shipment Tracking — VidaBuddies",
  robots: { index: false, follow: false },
};

const byId = (arr: any[], id: any) => (arr || []).find((x: any) => x?.id === id);

function InvalidLink({ reason }: { reason: string }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center">
        <div className="text-4xl mb-3">🔒</div>
        <h1 className="text-lg font-bold text-slate-800">This tracking link isn&apos;t valid</h1>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">{reason}</p>
        <p className="text-xs text-slate-400 mt-6">
          Need a new link? Ask your VidaBuddies contact to resend the shipment update email.
        </p>
      </div>
    </div>
  );
}

export default async function PublicTrackingPage({
  params,
  searchParams,
}: {
  params: Promise<{ containerNo: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { containerNo: rawContainer } = await params;
  const { t } = await searchParams;
  const containerNo = decodeURIComponent(rawContainer || "").trim().toUpperCase();

  if (!containerNo || !verifyTrackingToken(containerNo, t || "")) {
    return <InvalidLink reason="The secure token in this link is missing or incorrect. Tracking links are unique per shipment and can't be modified." />;
  }

  await connectToDatabase();
  const ship = await VBshipping.findOne(
    { containerNo },
    { driveDocuments: 0, shippingTrackingRecords: { $slice: -1 } }
  ).lean();

  if (!ship) {
    return <InvalidLink reason="We couldn't find this shipment. It may have been archived." />;
  }

  const delivered = isDeliveredStatus(latestRawStatus(ship));
  const base = buildShipmentEmailData(ship, publicAppUrl(), delivered);

  // ── Map data: route polylines + port markers from the raw SeaRates payload ──
  const records = (ship as any).shippingTrackingRecords || [];
  const lastRecord = records.length > 0 ? records[records.length - 1] : null;
  const raw = parseRawJson(lastRecord?.raw_json);
  const routeData = raw?.data?.route_data || {};
  const rawSegments = Array.isArray(routeData.route) ? routeData.route : [];

  const mapSegments = rawSegments.map((seg: any) => ({
    path: (Array.isArray(seg.path) ? seg.path : []).filter(
      (p: any) => Array.isArray(p) && p.length >= 2 && isFinite(p[0]) && isFinite(p[1])
    ),
    from:
      seg.from?.lat != null
        ? { name: seg.from.name || "", country: seg.from.country || "", lat: Number(seg.from.lat), lng: Number(seg.from.lng) }
        : null,
    to:
      seg.to?.lat != null
        ? { name: seg.to.name || "", country: seg.to.country || "", lat: Number(seg.to.lat), lng: Number(seg.to.lng) }
        : null,
    vessel: seg.vessel?.name || "",
  }));

  const data: PublicTrackingData = {
    ...base,
    mapSegments,
    dataUpdatedAt: raw?.data?.metadata?.updated_at || lastRecord?.updated_at || "",
  };

  return <PublicTrackingView data={data} />;
}
