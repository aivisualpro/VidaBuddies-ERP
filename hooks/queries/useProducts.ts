import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const productKeys = {
  all: ["products"] as const,
  detail: (id: string) => ["products", id] as const,
};

async function fetchProducts() {
  const res = await fetch("/api/admin/products");
  if (!res.ok) throw new Error("Failed to fetch products");
  return res.json();
}

/** List all products — replaces useUserDataStore().products */
export function useProducts() {
  return useQuery<any[]>({
    queryKey: productKeys.all,
    queryFn: fetchProducts,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create product");
      return res.json();
    },
    onMutate: async (newItem) => {
      await queryClient.cancelQueries({ queryKey: productKeys.all });
      const previous = queryClient.getQueryData<any[]>(productKeys.all);
      queryClient.setQueryData<any[]>(productKeys.all, (old = []) => [
        { _id: `temp-${Date.now()}`, ...newItem },
        ...old,
      ]);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(productKeys.all, ctx.previous);
      toast.error("Failed to create — changes reverted", { duration: Infinity });
    },
    onSuccess: () => toast.success("Product created"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: productKeys.all }),
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update product");
      return res.json();
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: productKeys.all });
      const previous = queryClient.getQueryData<any[]>(productKeys.all);
      queryClient.setQueryData<any[]>(productKeys.all, (old = []) =>
        old.map((p) => (p._id === id ? { ...p, ...data } : p))
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(productKeys.all, ctx.previous);
      toast.error("Failed to update — changes reverted", { duration: Infinity });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: productKeys.all }),
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete product");
      return res.json();
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: productKeys.all });
      const previous = queryClient.getQueryData<any[]>(productKeys.all);
      queryClient.setQueryData<any[]>(productKeys.all, (old = []) =>
        old.filter((p) => p._id !== id)
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(productKeys.all, ctx.previous);
      toast.error("Failed to delete — changes reverted", { duration: Infinity });
    },
    onSuccess: () => toast.success("Product deleted"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: productKeys.all }),
  });
}
