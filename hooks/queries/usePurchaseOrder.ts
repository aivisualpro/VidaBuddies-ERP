import { useQuery } from "@tanstack/react-query";
import { purchaseOrderKeys } from "./usePurchaseOrders";

async function fetchPurchaseOrder(id: string) {
  const res = await fetch(`/api/admin/purchase-orders/${id}`);
  if (!res.ok) throw new Error("Failed to fetch purchase order");
  return res.json();
}

/**
 * Fetches a single purchase order by ID.
 * Used on the PO detail page alongside parallel CPO/shipping queries.
 */
export function usePurchaseOrder(id: string) {
  return useQuery<any>({
    queryKey: purchaseOrderKeys.detail(id),
    queryFn: () => fetchPurchaseOrder(id),
    enabled: !!id,
  });
}
