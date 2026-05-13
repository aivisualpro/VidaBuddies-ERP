import { useQuery } from "@tanstack/react-query";

/**
 * Centralized query key factory for all purchase-order-related queries.
 * Using a factory keeps keys consistent across list, detail, and mutation invalidation.
 */
export const purchaseOrderKeys = {
  all:    ["purchase-orders"] as const,
  detail: (id: string) => ["purchase-orders", id] as const,
};

async function fetchPurchaseOrders() {
  const res = await fetch("/api/admin/purchase-orders");
  if (!res.ok) throw new Error("Failed to fetch purchase orders");
  return res.json();
}

/**
 * Fetches the full list of purchase orders from /api/admin/purchase-orders.
 * Replaces the Zustand `purchaseOrders` slice for migrated consumers.
 *
 * Defaults inherited from QueryProvider:
 *   staleTime: 30s, gcTime: 5min, refetchOnWindowFocus, retry: 1
 */
export function usePurchaseOrders() {
  return useQuery<any[]>({
    queryKey: purchaseOrderKeys.all,
    queryFn: fetchPurchaseOrders,
  });
}
