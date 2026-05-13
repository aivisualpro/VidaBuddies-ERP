import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const customerPOKeys = {
  all: ["vb-customer-po"] as const,
  byPO: (poId: string) => ["customer-pos", poId] as const,
  detail: (id: string) => ["vb-customer-po", id] as const,
};

export function useCustomerPOs() {
  return useQuery<any[]>({
    queryKey: customerPOKeys.all,
    queryFn: async () => { const r = await fetch("/api/admin/vb-customer-po"); if (!r.ok) throw new Error("Failed"); return r.json(); },
  });
}

export function useCreateCustomerPO() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, any>) => { const r = await fetch("/api/admin/vb-customer-po", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); if (!r.ok) throw new Error("Failed"); return r.json(); },
    onSuccess: () => { toast.success("Customer PO created"); qc.invalidateQueries({ queryKey: customerPOKeys.all }); },
    onError: () => toast.error("Failed to create customer PO", { duration: Infinity }),
  });
}

export function useDeleteCustomerPO() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const r = await fetch(`/api/admin/vb-customer-po/${id}`, { method: "DELETE" }); if (!r.ok) throw new Error("Failed"); return r.json(); },
    onMutate: async (id) => { await qc.cancelQueries({ queryKey: customerPOKeys.all }); const prev = qc.getQueryData<any[]>(customerPOKeys.all); qc.setQueryData<any[]>(customerPOKeys.all, (old = []) => old.filter((c) => c._id !== id)); return { prev }; },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(customerPOKeys.all, ctx.prev); toast.error("Failed to delete — changes reverted", { duration: Infinity }); },
    onSuccess: () => toast.success("Customer PO deleted"),
    onSettled: () => qc.invalidateQueries({ queryKey: customerPOKeys.all }),
  });
}
