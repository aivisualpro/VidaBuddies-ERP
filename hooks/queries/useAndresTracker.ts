import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const andresTrackerKeys = {
  all: ["andres-tracker"] as const,
};

export function useAndresTracker() {
  return useQuery<any[]>({
    queryKey: andresTrackerKeys.all,
    queryFn: async () => { const r = await fetch("/api/admin/andres-tracker"); if (!r.ok) throw new Error("Failed"); return r.json(); },
  });
}

export function useUpdateAndresTracker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => { const r = await fetch(`/api/admin/andres-tracker/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); if (!r.ok) throw new Error("Failed"); return r.json(); },
    onMutate: async ({ id, data }) => { await qc.cancelQueries({ queryKey: andresTrackerKeys.all }); const prev = qc.getQueryData<any[]>(andresTrackerKeys.all); qc.setQueryData<any[]>(andresTrackerKeys.all, (old = []) => old.map((r) => (r._id === id ? { ...r, ...data } : r))); return { prev }; },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(andresTrackerKeys.all, ctx.prev); toast.error("Failed to update — changes reverted", { duration: Infinity }); },
    onSettled: () => qc.invalidateQueries({ queryKey: andresTrackerKeys.all }),
  });
}
