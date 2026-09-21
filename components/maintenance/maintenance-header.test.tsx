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
      "Roster",
      "+ Aircraft",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("links the actions whose pages exist", () => {
    // This assertion used to be "disables every action until the M3
    // sub-modules ship", and that premise is what went wrong: five of
    // them shipped and the header kept rendering them dimmed. The
    // department nav linked them; this header — which is what somebody
    // standing on /maintenance actually reaches for — did not.
    render(<MaintenanceHeader />);

    const expected: Record<string, string> = {
      Squawks: "/maintenance/squawks",
      MEL: "/maintenance/mel",
      // Not /maintenance/expiration — that is the parts shelf-life
      // report. The due list is the Maintenance Clock.
      "Due List": "/maintenance/mx-clock",
      "Work Orders": "/maintenance/work-orders",
      Inventory: "/maintenance/inventory",
      "RTS Queue": "/maintenance/rts",
      // Adding a tail ships under Settings, not /maintenance — which is
      // exactly why it was missed. See below.
      "+ Aircraft": "/settings/fleet",
    };
    for (const [label, href] of Object.entries(expected)) {
      const action = screen.getByText(label);
      expect(action.tagName, `${label} should be a link`).toBe("A");
      expect(action).toHaveAttribute("href", href);
    }
  });

  it("still dims the three with no page behind them", () => {
    // Inspections, Vendors and Roster genuinely have no route. Dimmed
    // is right for those — the failure mode this file now guards
    // against is the opposite one.
    //
    // "+ Aircraft" used to be in this list, asserted to be a dimmed
    // SPAN, on the stated grounds that it was "an add form we never
    // built". It was built: /settings/fleet has rendered
    // AddAircraftDialog against createAircraftAction since M2. The
    // belief was wrong, so the test passed while the button stayed
    // dead — a mechanic on /maintenance had no way to reach it. Only
    // the /maintenance prefix was ever checked.
    render(<MaintenanceHeader />);

    for (const label of ["Inspections", "Vendors", "Roster"]) {
      const action = screen.getByText(label);
      expect(action.tagName).toBe("SPAN");
      expect(action).toHaveAttribute("aria-disabled", "true");
      expect(action).toHaveAttribute("title", "Coming in M3");
    }
  });
});
