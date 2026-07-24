/**
 * Pagination réutilisable (basée sur PaginationResult<T>).
 */

"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PaginationResult<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type PaginationProps<T> = {
  data: PaginationResult<T>;
  onPageChange: (page: number) => void;
  renderItem: (item: T) => React.ReactNode;
  className?: string;
};

export function Pagination<T>({
  data,
  onPageChange,
  renderItem,
  className,
}: PaginationProps<T>) {
  const { page, totalPages, items } = data;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid gap-4">{items.map(renderItem)}</div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
