/**
 * Tests unitaires pour useLogin.
 */

import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLogin } from "@/hooks/auth/useLogin";
import { useAuthStore } from "@/store/authStore";

const createWrapper = () => {
  const queryClient = new QueryClient();
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useLogin", () => {
  it("existe", () => {
    expect(useLogin).toBeDefined();
  });
});
