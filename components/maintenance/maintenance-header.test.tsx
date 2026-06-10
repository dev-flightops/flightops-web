import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MaintenanceHeader } from "./maintenance-header";

describe("MaintenanceHeader", () => {
  it("renders the legacy title + subtitle copy", () => {
    render(<MaintenanceHeader />);

    expect(
      screen.getByRole("heading", { name: /fleet management/i, level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/aircraft, maintenance, work orders, and vendors/i),
    ).toBeInTheDocument();
  });

  it("renders the 8 legacy action entries", () => {
    render(<MaintenanceHeader />);

    for (const label of [
      "Due List",
      "Work Orders",
      "Inspections",
      "Inventory",
      "Vendors",
      "RTS Queue",
      "🗓 Roster",
      "+ Aircraft",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("disables every action until the M3 sub-modules ship", () => {
    // None of the sub-modules are built yet — verify they render as
    // role=button + aria-disabled with the milestone tooltip, not as
    // real <a href> links that would 404.
    render(<MaintenanceHeader />);

    for (const label of ["Due List", "Work Orders", "+ Aircraft"]) {
      const action = screen.getByText(label);
      expect(action.tagName).toBe("SPAN");
      expect(action).toHaveAttribute("aria-disabled", "true");
      expect(action).toHaveAttribute("title", "Coming in M3");
    }
  });
});
