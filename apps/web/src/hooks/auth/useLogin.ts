/**
 * Mutation React Query pour /auth/login.
 * Stocke le token + user dans le store Zustand.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/apiClient";
import { useAuthStore } from "@/store/authStore";

export type LoginInput = {
  email: string;
  password: string;
};

export type LoginResult = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    pseudo: string;
    avatarUrl?: string;
  };
};

export function useLogin() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);

  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const data = await apiFetch<LoginResult>("/auth/login", {
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
