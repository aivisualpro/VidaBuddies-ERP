import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const timelineKeys = {
  all: ["timeline"] as const,
  detail: (id: string) => ["timeline", id] as const,
};

export function useTimeline() {
  return useQuery<any[]>({
    queryKey: timelineKeys.all,
    queryFn: async () => { const r = await fetch("/api/admin/timeline"); if (!r.ok) throw new Error("Failed"); return r.json(); },
  });
}

export function useCreateTimelineEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, any>) => { const r = await fetch("/api/admin/timeline", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); if (!r.ok) throw new Error("Failed"); return r.json(); },
    onSuccess: () => { toast.success("Timeline entry created"); qc.invalidateQueries({ queryKey: timelineKeys.all }); },
    onError: () => toast.error("Failed to create timeline entry", { duration: Infinity }),
  });
}

export function useUpdateTimelineEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => { const r = await fetch(`/api/admin/timeline/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); if (!r.ok) throw new Error("Failed"); return r.json(); },
    onMutate: async ({ id, data }) => { await qc.cancelQueries({ queryKey: timelineKeys.all }); const prev = qc.getQueryData<any[]>(timelineKeys.all); qc.setQueryData<any[]>(timelineKeys.all, (old = []) => old.map((e) => (e._id === id ? { ...e, ...data } : e))); return { prev }; },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(timelineKeys.all, ctx.prev); toast.error("Failed to update — changes reverted", { duration: Infinity }); },
    onSettled: () => qc.invalidateQueries({ queryKey: timelineKeys.all }),
  });
}

export function useDeleteTimelineEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const r = await fetch(`/api/admin/timeline/${id}`, { method: "DELETE" }); if (!r.ok) throw new Error("Failed"); return r.json(); },
    onMutate: async (id) => { await qc.cancelQueries({ queryKey: timelineKeys.all }); const prev = qc.getQueryData<any[]>(timelineKeys.all); qc.setQueryData<any[]>(timelineKeys.all, (old = []) => old.filter((e) => e._id !== id)); return { prev }; },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(timelineKeys.all, ctx.prev); toast.error("Failed to delete — changes reverted", { duration: Infinity }); },
    onSuccess: () => toast.success("Timeline entry deleted"),
    onSettled: () => qc.invalidateQueries({ queryKey: timelineKeys.all }),
  });
}
