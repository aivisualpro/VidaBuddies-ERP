import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const shippingKeys = {
  all: ["vb-shipping"] as const,
  byPO: (poId: string) => ["shippings", { VBNumber: poId }] as const,
  detail: (id: string) => ["vb-shipping", id] as const,
};

export function useShippings() {
  return useQuery<any[]>({
    queryKey: shippingKeys.all,
    queryFn: async () => { const r = await fetch("/api/admin/vb-shipping"); if (!r.ok) throw new Error("Failed"); return r.json(); },
  });
}

export function useCreateShipping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, any>) => { const r = await fetch("/api/admin/vb-shipping", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); if (!r.ok) throw new Error("Failed"); return r.json(); },
    onSuccess: () => { toast.success("Shipping created"); qc.invalidateQueries({ queryKey: shippingKeys.all }); },
    onError: () => toast.error("Failed to create shipping", { duration: Infinity }),
  });
}

export function useUpdateShipping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => { const r = await fetch(`/api/admin/vb-shipping/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); if (!r.ok) throw new Error("Failed"); return r.json(); },
    onMutate: async ({ id, data }) => { await qc.cancelQueries({ queryKey: shippingKeys.all }); const prev = qc.getQueryData<any[]>(shippingKeys.all); qc.setQueryData<any[]>(shippingKeys.all, (old = []) => old.map((s) => (s._id === id ? { ...s, ...data } : s))); return { prev }; },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(shippingKeys.all, ctx.prev); toast.error("Failed to update — changes reverted", { duration: Infinity }); },
    onSettled: () => qc.invalidateQueries({ queryKey: shippingKeys.all }),
  });
}

export function useDeleteShipping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const r = await fetch(`/api/admin/vb-shipping/${id}`, { method: "DELETE" }); if (!r.ok) throw new Error("Failed"); return r.json(); },
    onMutate: async (id) => { await qc.cancelQueries({ queryKey: shippingKeys.all }); const prev = qc.getQueryData<any[]>(shippingKeys.all); qc.setQueryData<any[]>(shippingKeys.all, (old = []) => old.filter((s) => s._id !== id)); return { prev }; },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(shippingKeys.all, ctx.prev); toast.error("Failed to delete — changes reverted", { duration: Infinity }); },
    onSuccess: () => toast.success("Shipping deleted"),
    onSettled: () => qc.invalidateQueries({ queryKey: shippingKeys.all }),
  });
}
