import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MaintenanceShell } from "./subpage-shell";

describe("MaintenanceShell", () => {
  it("renders title, subtitle, and empty-state text", () => {
    render(
      <MaintenanceShell
        title="Work Orders"
        subtitle="0 open · 0 in progress"
        emptyText="No work orders yet."
      />,
    );
    expect(screen.getByRole("heading", { name: "Work Orders" })).toBeDefined();
    expect(screen.getByText("0 open · 0 in progress")).toBeDefined();
    expect(screen.getByText("No work orders yet.")).toBeDefined();
  });

  it("renders CTA buttons as disabled with a tooltip and the primary variant on the primary CTA", () => {
    render(
      <MaintenanceShell
        title="Inventory"
        emptyText="No parts."
        backendHint="Backend not ready"
        ctas={[
          { label: "Filter" },
          { label: "+ New Part", primary: true },
        ]}
      />,
    );
    const filter = screen.getByRole("button", { name: "Filter" });
    const newPart = screen.getByRole("button", { name: "+ New Part" });
    for (const b of [filter, newPart]) {
      expect(b.getAttribute("aria-disabled")).toBe("true");
      expect(b.getAttribute("title")).toBe("Backend not ready");
    }
    // Primary CTA carries the status-blue background token.
    expect(newPart.className).toContain("bg-status-blue");
    expect(filter.className).not.toContain("bg-status-blue");
  });

  it("renders children instead of the empty state when provided", () => {
    render(
      <MaintenanceShell title="Availability" emptyText="fallback empty">
        <div data-testid="custom-body">custom body</div>
      </MaintenanceShell>,
    );
    expect(screen.getByTestId("custom-body")).toBeDefined();
    expect(screen.queryByText("fallback empty")).toBeNull();
  });
});
