import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const releaseRequestKeys = {
  all: ["release-requests"] as const,
  detail: (id: string) => ["release-requests", id] as const,
};

export function useReleaseRequests() {
  return useQuery<any[]>({
    queryKey: releaseRequestKeys.all,
    queryFn: async () => { const r = await fetch("/api/admin/release-requests"); if (!r.ok) throw new Error("Failed"); return r.json(); },
  });
}

export function useCreateReleaseRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, any>) => { const r = await fetch("/api/admin/release-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); if (!r.ok) throw new Error("Failed"); return r.json(); },
    onSuccess: () => { toast.success("Release request created"); qc.invalidateQueries({ queryKey: releaseRequestKeys.all }); },
    onError: () => toast.error("Failed to create release request", { duration: Infinity }),
  });
}

export function useUpdateReleaseRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => { const r = await fetch(`/api/admin/release-requests/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); if (!r.ok) throw new Error("Failed"); return r.json(); },
    onMutate: async ({ id, data }) => { await qc.cancelQueries({ queryKey: releaseRequestKeys.all }); const prev = qc.getQueryData<any[]>(releaseRequestKeys.all); qc.setQueryData<any[]>(releaseRequestKeys.all, (old = []) => old.map((r) => (r._id === id ? { ...r, ...data } : r))); return { prev }; },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(releaseRequestKeys.all, ctx.prev); toast.error("Failed to update — changes reverted", { duration: Infinity }); },
    onSettled: () => qc.invalidateQueries({ queryKey: releaseRequestKeys.all }),
  });
}

export function useDeleteReleaseRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const r = await fetch(`/api/admin/release-requests/${id}`, { method: "DELETE" }); if (!r.ok) throw new Error("Failed"); return r.json(); },
    onMutate: async (id) => { await qc.cancelQueries({ queryKey: releaseRequestKeys.all }); const prev = qc.getQueryData<any[]>(releaseRequestKeys.all); qc.setQueryData<any[]>(releaseRequestKeys.all, (old = []) => old.filter((r) => r._id !== id)); return { prev }; },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(releaseRequestKeys.all, ctx.prev); toast.error("Failed to delete — changes reverted", { duration: Infinity }); },
    onSuccess: () => toast.success("Release request deleted"),
    onSettled: () => qc.invalidateQueries({ queryKey: releaseRequestKeys.all }),
  });
}
