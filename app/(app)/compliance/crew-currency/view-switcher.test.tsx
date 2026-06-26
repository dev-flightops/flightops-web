import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { isComplianceView, ViewSwitcher } from "./view-switcher";

describe("isComplianceView", () => {
  it("accepts the three known views", () => {
    expect(isComplianceView("grid")).toBe(true);
    expect(isComplianceView("list")).toBe(true);
    expect(isComplianceView("calendar")).toBe(true);
  });
  it("rejects everything else", () => {
    expect(isComplianceView("matrix")).toBe(false);
    expect(isComplianceView(null)).toBe(false);
    expect(isComplianceView(undefined)).toBe(false);
  });
});

describe("ViewSwitcher", () => {
  it("renders three links and marks the active one with aria-current", () => {
    render(<ViewSwitcher active="list" statusFilter={null} />);
    const grid = screen.getByRole("link", { name: "Grid" });
    const list = screen.getByRole("link", { name: "List" });
    const calendar = screen.getByRole("link", { name: "Calendar" });
    expect(grid).toBeInTheDocument();
    expect(list).toHaveAttribute("aria-current", "page");
    expect(calendar).toBeInTheDocument();
  });

  it("omits the ?view= param for the grid link (default)", () => {
    render(<ViewSwitcher active="list" statusFilter={null} />);
    expect(screen.getByRole("link", { name: "Grid" })).toHaveAttribute(
      "href",
      "/compliance/crew-currency",
    );
  });

  it("preserves the status filter across views", () => {
    render(
      <ViewSwitcher active="grid" statusFilter="grace_month" />,
    );
    expect(screen.getByRole("link", { name: "Grid" })).toHaveAttribute(
      "href",
      "/compliance/crew-currency?status=grace_month",
    );
    expect(screen.getByRole("link", { name: "List" })).toHaveAttribute(
      "href",
      "/compliance/crew-currency?view=list&status=grace_month",
    );
    expect(screen.getByRole("link", { name: "Calendar" })).toHaveAttribute(
      "href",
      "/compliance/crew-currency?view=calendar&status=grace_month",
    );
  });
});
