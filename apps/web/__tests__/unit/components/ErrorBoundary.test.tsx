import React from "react";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";

describe("ErrorBoundary", () => {
  it("rend les enfants sans erreur", () => {
    render(
      <ErrorBoundary>
        <div>Test enfant</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("Test enfant")).toBeInTheDocument();
  });

  it("affiche le fallback en cas d erreur", () => {
    const ProblemChild = () => {
      throw new Error("Erreur de test");
    };

    render(
      <ErrorBoundary fallback={<div>Fallback</div>}>
        <ProblemChild />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Fallback")).toBeInTheDocument();
  });
});
