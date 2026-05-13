import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const warehouseKeys = {
  all: ["warehouses"] as const,
  detail: (id: string) => ["warehouses", id] as const,
};

async function fetchWarehouses() {
  const res = await fetch("/api/admin/warehouse");
  if (!res.ok) throw new Error("Failed to fetch warehouses");
  return res.json();
}

/** List all warehouses — replaces useUserDataStore().warehouses */
export function useWarehouses() {
  return useQuery<any[]>({
    queryKey: warehouseKeys.all,
    queryFn: fetchWarehouses,
  });
}

export function useCreateWarehouse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await fetch("/api/admin/warehouse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create warehouse");
      return res.json();
    },
    onMutate: async (newItem) => {
      await queryClient.cancelQueries({ queryKey: warehouseKeys.all });
      const previous = queryClient.getQueryData<any[]>(warehouseKeys.all);
      queryClient.setQueryData<any[]>(warehouseKeys.all, (old = []) => [
        { _id: `temp-${Date.now()}`, ...newItem },
        ...old,
      ]);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(warehouseKeys.all, ctx.previous);
      toast.error("Failed to create — changes reverted", { duration: Infinity });
    },
    onSuccess: () => toast.success("Warehouse created"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: warehouseKeys.all }),
  });
}

export function useUpdateWarehouse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      const res = await fetch(`/api/admin/warehouse/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update warehouse");
      return res.json();
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: warehouseKeys.all });
      const previous = queryClient.getQueryData<any[]>(warehouseKeys.all);
      queryClient.setQueryData<any[]>(warehouseKeys.all, (old = []) =>
        old.map((w) => (w._id === id ? { ...w, ...data } : w))
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(warehouseKeys.all, ctx.previous);
      toast.error("Failed to update — changes reverted", { duration: Infinity });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: warehouseKeys.all }),
  });
}

export function useDeleteWarehouse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/warehouse/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete warehouse");
      return res.json();
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: warehouseKeys.all });
      const previous = queryClient.getQueryData<any[]>(warehouseKeys.all);
      queryClient.setQueryData<any[]>(warehouseKeys.all, (old = []) =>
        old.filter((w) => w._id !== id)
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(warehouseKeys.all, ctx.previous);
      toast.error("Failed to delete — changes reverted", { duration: Infinity });
    },
    onSuccess: () => toast.success("Warehouse deleted"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: warehouseKeys.all }),
  });
}
