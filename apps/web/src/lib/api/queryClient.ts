/**
 * Configuration globale React Query (TanStack Query).
 *
 * Règles :
 - staleTime 5min, gcTime 10min.
 - Refetch au focus fenêtre.
 - Retry 1 (pas de retry sur 4xx).
 - Cache hors SSR par défaut.
 */

import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: (failureCount, error) => {
        if (error instanceof Error) {
          const status = (error as Error & { status?: number }).status;
          if (status && status >= 400 && status < 500) return false;
        }
        return failureCount < 1;
      },
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false,
    },
  },
});
