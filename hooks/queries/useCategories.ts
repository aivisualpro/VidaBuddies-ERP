import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const categoryKeys = {
  all: ["categories"] as const,
  detail: (id: string) => ["categories", id] as const,
};

async function fetchCategories() {
  const res = await fetch("/api/admin/categories");
  if (!res.ok) throw new Error("Failed to fetch categories");
  return res.json();
}

/** List all categories — replaces useUserDataStore().categories */
export function useCategories() {
  return useQuery<any[]>({
    queryKey: categoryKeys.all,
    queryFn: fetchCategories,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create category");
      return res.json();
    },
    onMutate: async (newItem) => {
      await queryClient.cancelQueries({ queryKey: categoryKeys.all });
      const previous = queryClient.getQueryData<any[]>(categoryKeys.all);
      queryClient.setQueryData<any[]>(categoryKeys.all, (old = []) => [
        { _id: `temp-${Date.now()}`, ...newItem },
        ...old,
      ]);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(categoryKeys.all, ctx.previous);
      toast.error("Failed to create — changes reverted", { duration: Infinity });
    },
    onSuccess: () => toast.success("Category created"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: categoryKeys.all }),
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update category");
      return res.json();
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: categoryKeys.all });
      const previous = queryClient.getQueryData<any[]>(categoryKeys.all);
      queryClient.setQueryData<any[]>(categoryKeys.all, (old = []) =>
        old.map((c) => (c._id === id ? { ...c, ...data } : c))
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(categoryKeys.all, ctx.previous);
      toast.error("Failed to update — changes reverted", { duration: Infinity });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: categoryKeys.all }),
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete category");
      return res.json();
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: categoryKeys.all });
      const previous = queryClient.getQueryData<any[]>(categoryKeys.all);
      queryClient.setQueryData<any[]>(categoryKeys.all, (old = []) =>
        old.filter((c) => c._id !== id)
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(categoryKeys.all, ctx.previous);
      toast.error("Failed to delete — changes reverted", { duration: Infinity });
    },
    onSuccess: () => toast.success("Category deleted"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: categoryKeys.all }),
  });
}
