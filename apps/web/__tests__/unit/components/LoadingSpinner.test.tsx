/**
 * Tests unitaires pour LoadingSpinner.
 */

import { render, screen } from "@testing-library/react";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";

describe("LoadingSpinner", () => {
  it("rend un spinner", () => {
    render(<LoadingSpinner />);
    const spinner = document.querySelector("svg");
    expect(spinner).toBeInTheDocument();
  });
});
