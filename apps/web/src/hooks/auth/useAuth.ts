/**
 * Hook d’accès au store d’authentification.
 * Fournit l’état courant (user, token, isAuthenticated, isLoading).
 */

import { useAuthStore } from "@/store/authStore";

export function useAuth() {
  return useAuthStore();
}
