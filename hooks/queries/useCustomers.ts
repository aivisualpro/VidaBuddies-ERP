import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const customerKeys = {
  all: ["customers"] as const,
  detail: (id: string) => ["customers", id] as const,
};

async function fetchCustomers() {
  const res = await fetch("/api/admin/customers");
  if (!res.ok) throw new Error("Failed to fetch customers");
  return res.json();
}

export function useCustomers() {
  return useQuery<any[]>({ queryKey: customerKeys.all, queryFn: fetchCustomers });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await fetch("/api/admin/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed"); return res.json();
    },
    onMutate: async (n) => { await qc.cancelQueries({ queryKey: customerKeys.all }); const prev = qc.getQueryData<any[]>(customerKeys.all); qc.setQueryData<any[]>(customerKeys.all, (old = []) => [{ _id: `temp-${Date.now()}`, ...n }, ...old]); return { prev }; },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(customerKeys.all, ctx.prev); toast.error("Failed to create — changes reverted", { duration: Infinity }); },
    onSuccess: () => toast.success("Customer created"),
    onSettled: () => qc.invalidateQueries({ queryKey: customerKeys.all }),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      const res = await fetch(`/api/admin/customers/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error("Failed"); return res.json();
    },
    onMutate: async ({ id, data }) => { await qc.cancelQueries({ queryKey: customerKeys.all }); const prev = qc.getQueryData<any[]>(customerKeys.all); qc.setQueryData<any[]>(customerKeys.all, (old = []) => old.map((c) => (c._id === id ? { ...c, ...data } : c))); return { prev }; },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(customerKeys.all, ctx.prev); toast.error("Failed to update — changes reverted", { duration: Infinity }); },
    onSettled: () => qc.invalidateQueries({ queryKey: customerKeys.all }),
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const res = await fetch(`/api/admin/customers/${id}`, { method: "DELETE" }); if (!res.ok) throw new Error("Failed"); return res.json(); },
    onMutate: async (id) => { await qc.cancelQueries({ queryKey: customerKeys.all }); const prev = qc.getQueryData<any[]>(customerKeys.all); qc.setQueryData<any[]>(customerKeys.all, (old = []) => old.filter((c) => c._id !== id)); return { prev }; },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(customerKeys.all, ctx.prev); toast.error("Failed to delete — changes reverted", { duration: Infinity }); },
    onSuccess: () => toast.success("Customer deleted"),
    onSettled: () => qc.invalidateQueries({ queryKey: customerKeys.all }),
  });
}
