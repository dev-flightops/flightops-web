import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReportPhotos } from "./report-photos";

describe("a village report's photos (#121)", () => {
  it("shows each small, opening full size in a new tab", () => {
    render(<ReportPhotos photos={[{ id: "p-1", width: 1280, height: 960 }, { id: "p-2", width: 960, height: 1280 }]} />);
    const first = screen.getByRole("link", { name: "Photo 1 of 2, full size in a new tab" });
    expect(first).toHaveAttribute("href", "/api/village-photos/p-1");
    expect(first).toHaveAttribute("target", "_blank");
    expect(first.querySelector("img")).toHaveAttribute("src", "/api/village-photos/p-1");
  });

  it("shows nothing without any", () => {
    const { container } = render(<ReportPhotos photos={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
