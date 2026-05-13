import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { purchaseOrderKeys } from "./usePurchaseOrders";

// ─── CREATE ─────────────────────────────────────────────────────────────────────
export function useCreatePO() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await fetch("/api/admin/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create purchase order");
      return res.json();
    },

    onMutate: async (newPO) => {
      await queryClient.cancelQueries({ queryKey: purchaseOrderKeys.all });
      const previous = queryClient.getQueryData<any[]>(purchaseOrderKeys.all);
      queryClient.setQueryData<any[]>(purchaseOrderKeys.all, (old = []) => [
        { _id: `temp-${Date.now()}`, ...newPO, customerPO: [] },
        ...old,
      ]);
      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(purchaseOrderKeys.all, context.previous);
      }
      toast.error("Failed to create — changes reverted", { duration: Infinity });
    },

    onSuccess: () => {
      toast.success("Purchase Order created");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.all });
    },
  });
}

// ─── UPDATE ─────────────────────────────────────────────────────────────────────
export function useUpdatePO() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Record<string, any>;
    }) => {
      const res = await fetch(`/api/admin/purchase-orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update purchase order");
      return res.json();
    },

    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: purchaseOrderKeys.all });
      await queryClient.cancelQueries({
        queryKey: purchaseOrderKeys.detail(id),
      });

      const previousList = queryClient.getQueryData<any[]>(
        purchaseOrderKeys.all
      );
      const previousDetail = queryClient.getQueryData<any>(
        purchaseOrderKeys.detail(id)
      );

      // Optimistic list update
      queryClient.setQueryData<any[]>(purchaseOrderKeys.all, (old = []) =>
        old.map((po) => (po._id === id ? { ...po, ...data } : po))
      );

      // Optimistic detail update
      queryClient.setQueryData(purchaseOrderKeys.detail(id), (old: any) =>
        old ? { ...old, ...data } : old
      );

      return { previousList, previousDetail, id };
    },

    onError: (_err, _vars, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(purchaseOrderKeys.all, context.previousList);
      }
      if (context?.previousDetail && context?.id) {
        queryClient.setQueryData(
          purchaseOrderKeys.detail(context.id),
          context.previousDetail
        );
      }
      toast.error("Failed to update — changes reverted", { duration: Infinity });
    },

    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.all });
      queryClient.invalidateQueries({
        queryKey: purchaseOrderKeys.detail(vars.id),
      });
    },
  });
}

// ─── DELETE ─────────────────────────────────────────────────────────────────────
export function useDeletePO() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/purchase-orders/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete purchase order");
      return res.json();
    },

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: purchaseOrderKeys.all });
      const previous = queryClient.getQueryData<any[]>(purchaseOrderKeys.all);
      queryClient.setQueryData<any[]>(purchaseOrderKeys.all, (old = []) =>
        old.filter((po) => po._id !== id)
      );
      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(purchaseOrderKeys.all, context.previous);
      }
      toast.error("Failed to delete — changes reverted", { duration: Infinity });
    },

    onSuccess: () => {
      toast.success("Purchase Order deleted");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.all });
    },
  });
}
