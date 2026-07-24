import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRegister } from "@/hooks/auth/useRegister";
import { useAuthStore } from "@/store/authStore";

const createWrapper = () => {
  const queryClient = new QueryClient();
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useRegister", () => {
  it("existe", () => {
    expect(useRegister).toBeDefined();
  });
});
