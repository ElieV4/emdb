/**
 * Boundary pour capturer les erreurs de rendu React.
 */

"use client";

import React from "react";
import { Button } from "@/components/ui/button";

type ErrorBoundaryProps = {
  children?: React.ReactNode;
  fallback?: React.ReactNode;
  onReset?: () => void;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-4">
          <h2 className="text-xl font-semibold">Une erreur est survenue</h2>
          <p className="text-muted-foreground">{this.state.error?.message}</p>
          <Button onClick={this.handleReset}>Réessayer</Button>
        </div>
      );
    }
    return this.props.children ?? null;
  }
}
