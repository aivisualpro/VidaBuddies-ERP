import { useQuery } from "@tanstack/react-query";

/**
 * Query keys for live shipment (VBshipping) data.
 */
export const liveShipmentKeys = {
  all: ["live-shipments"] as const,
};

/** Normalize legacy/raw status values to app standard statuses */
export function normalizeShipmentStatus(raw: string): "Pending" | "Planned" | "In Transit" | "Delivered" {
  if (!raw) return "Pending";
  const s = raw.toLowerCase().trim();
  if (s === "delivered" || s === "arrived") return "Delivered";
  if (s === "in transit" || s === "in_transit" || s === "on water") return "In Transit";
  if (s === "planned" || s === "booking confirmed") return "Planned";
  if (s === "pending" || s === "ordered") return "Pending";
  if (raw === "Planned" || raw === "In Transit" || raw === "Delivered") return raw;
  return "Pending";
}

async function fetchLiveShipments() {
  // includeTracking=last → only the latest tracking record per shipment
  // (all consumers only need the last position/event — huge payload saving)
  const res = await fetch("/api/admin/vb-shipping?includeTracking=last");
  if (!res.ok) throw new Error("Failed to fetch shipments");
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Shared source of truth for live shipment records (VBshipping collection),
 * used by the dashboard map/stats AND the Live Shipments page. Because both
 * share one query key, navigating between them is instant (cache hit).
 */
export function useLiveShipments() {
  return useQuery<any[]>({
    queryKey: liveShipmentKeys.all,
    queryFn: fetchLiveShipments,
    staleTime: 60_000,
  });
}
