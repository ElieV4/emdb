import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLogout } from "@/hooks/auth/useLogout";
import { useAuthStore } from "@/store/authStore";

const createWrapper = () => {
  const queryClient = new QueryClient();
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useLogout", () => {
  it("existe", () => {
    expect(useLogout).toBeDefined();
  });
});
