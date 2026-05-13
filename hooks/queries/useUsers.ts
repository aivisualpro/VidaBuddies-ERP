import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const userKeys = {
  all: ["users"] as const,
  detail: (id: string) => ["users", id] as const,
};

async function fetchUsers() {
  const res = await fetch("/api/admin/users");
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

/** List all users — replaces useUserDataStore().users */
export function useUsers() {
  return useQuery<any[]>({
    queryKey: userKeys.all,
    queryFn: fetchUsers,
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update user");
      return res.json();
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: userKeys.all });
      const previous = queryClient.getQueryData<any[]>(userKeys.all);
      queryClient.setQueryData<any[]>(userKeys.all, (old = []) =>
        old.map((u) => (u._id === id ? { ...u, ...data } : u))
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(userKeys.all, ctx.previous);
      toast.error("Failed to update — changes reverted", { duration: Infinity });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: userKeys.all }),
  });
}
