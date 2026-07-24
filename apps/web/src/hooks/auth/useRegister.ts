/**
 * Mutation React Query pour /auth/register.
 * Stocke le token + user dans le store Zustand.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/apiClient";
import { useAuthStore } from "@/store/authStore";

export type RegisterInput = {
  email: string;
  pseudo: string;
  password: string;
};

export type RegisterResult = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    pseudo: string;
    avatarUrl?: string;
  };
};

export function useRegister() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);

  return useMutation({
    mutationFn: async (input: RegisterInput) => {
      const data = await apiFetch<RegisterResult>("/auth/register", {
        method: "POST",
        body: input,
      });
      return data;
    },
    onSuccess: (data) => {
      setAccessToken(data.accessToken);
      setUser(data.user);
      queryClient.invalidateQueries();
    },
  });
}
