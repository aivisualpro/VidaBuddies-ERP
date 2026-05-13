import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const carrierKeys = {
  all: ["carriers"] as const,
};

async function fetchCarriers() {
  const res = await fetch("/api/admin/carriers");
  if (!res.ok) throw new Error("Failed to fetch carriers");
  return res.json();
}

/** List all carriers — replaces useUserDataStore().carriers */
export function useCarriers() {
  return useQuery<any[]>({
    queryKey: carrierKeys.all,
    queryFn: fetchCarriers,
  });
}

/** Create a new carrier (used by inline "add" in dropdowns) */
export function useCreateCarrier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/admin/carriers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Failed to create carrier");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: carrierKeys.all });
    },
    onError: () => {
      toast.error("Failed to create carrier", { duration: Infinity });
    },
  });
}
