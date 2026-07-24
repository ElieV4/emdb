/**
 * Store Zustand pour l'authentification.
 */

import { create } from "zustand";

export type UserState = {
  user: {
    id: string;
    email: string;
    pseudo: string;
    avatarUrl?: string;
  } | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
};

export type AuthActions = {
  setUser: (user: UserState["user"]) => void;
  setAccessToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
};

export type AuthStore = UserState & AuthActions;

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: (user) =>
    set({
      user,
      isAuthenticated: !!user,
    }),
  setAccessToken: (accessToken) =>
    set({
      accessToken,
    }),
  setLoading: (isLoading) =>
    set({
      isLoading,
    }),
  logout: () =>
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
    }),
}));
