import React from "react";
import { render, screen } from "@testing-library/react";
import { Pagination } from "@/components/common/Pagination";

describe("Pagination", () => {
  const mockData = {
    items: [{ id: 1 }, { id: 2 }, { id: 3 }],
    total: 3,
    page: 1,
    limit: 10,
    totalPages: 1,
  };

  it("rend les items", () => {
    render(
      <Pagination
        data={mockData}
        onPageChange={() => {}}
        renderItem={(item) => <div key={item.id}>{item.id}</div>}
      />,
    );
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("affiche la pagination quand il y a plusieurs pages", () => {
    const multiPageData = {
      items: [{ id: 1 }],
      total: 20,
      page: 1,
      limit: 10,
      totalPages: 2,
    };

    render(
      <Pagination
        data={multiPageData}
        onPageChange={() => {}}
        renderItem={(item) => <div key={item.id}>{item.id}</div>}
      />,
    );
    expect(screen.getByText("Page 1 / 2")).toBeInTheDocument();
  });
});
