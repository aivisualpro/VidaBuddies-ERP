import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const supplierKeys = {
  all: ["suppliers"] as const,
  detail: (id: string) => ["suppliers", id] as const,
};

async function fetchSuppliers() {
  const res = await fetch("/api/admin/suppliers");
  if (!res.ok) throw new Error("Failed to fetch suppliers");
  return res.json();
}

/** List all suppliers — replaces useUserDataStore().suppliers */
export function useSuppliers() {
  return useQuery<any[]>({
    queryKey: supplierKeys.all,
    queryFn: fetchSuppliers,
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await fetch("/api/admin/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create supplier");
      return res.json();
    },
    onMutate: async (newItem) => {
      await queryClient.cancelQueries({ queryKey: supplierKeys.all });
      const previous = queryClient.getQueryData<any[]>(supplierKeys.all);
      queryClient.setQueryData<any[]>(supplierKeys.all, (old = []) => [
        { _id: `temp-${Date.now()}`, ...newItem },
        ...old,
      ]);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(supplierKeys.all, ctx.previous);
      toast.error("Failed to create — changes reverted", { duration: Infinity });
    },
    onSuccess: () => toast.success("Supplier created"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: supplierKeys.all }),
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      const res = await fetch(`/api/admin/suppliers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update supplier");
      return res.json();
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: supplierKeys.all });
      const previous = queryClient.getQueryData<any[]>(supplierKeys.all);
      queryClient.setQueryData<any[]>(supplierKeys.all, (old = []) =>
        old.map((s) => (s._id === id ? { ...s, ...data } : s))
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(supplierKeys.all, ctx.previous);
      toast.error("Failed to update — changes reverted", { duration: Infinity });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: supplierKeys.all }),
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/suppliers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete supplier");
      return res.json();
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: supplierKeys.all });
      const previous = queryClient.getQueryData<any[]>(supplierKeys.all);
      queryClient.setQueryData<any[]>(supplierKeys.all, (old = []) =>
        old.filter((s) => s._id !== id)
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(supplierKeys.all, ctx.previous);
      toast.error("Failed to delete — changes reverted", { duration: Infinity });
    },
    onSuccess: () => toast.success("Supplier deleted"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: supplierKeys.all }),
  });
}
