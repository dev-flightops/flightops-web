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

  it("shows only the actions that are built (#156)", () => {
    // The client, 10/29: "Six maintenance tabs look clickable, do
    // nothing: Due List, Inventory, RTS Queue, Inspections, Vendors,
    // Roster." The due list is built now; Greg (30 Oct): the rest hidden
    // until they are.
    render(<MaintenanceHeader />);

    for (const label of ["Squawks", "MEL", "Due List", "Work Orders", "+ Aircraft"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    for (const label of ["Inspections", "Inventory", "Vendors", "RTS Queue", "Roster"]) {
      expect(screen.queryByText(label)).toBeNull();
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
      // Not /maintenance/expiration (the parts shelf-life report) nor
      // the Maintenance Clock: the due list itself (#156).
      "Due List": "/maintenance/due-list",
      "Work Orders": "/maintenance/work-orders",
      // Adding a tail ships under Settings, not /maintenance — which is
      // exactly why it was missed: it sat dimmed as "an add form we never
      // built" while /settings/fleet had it.
      "+ Aircraft": "/settings/fleet",
    };
    for (const [label, href] of Object.entries(expected)) {
      const action = screen.getByText(label);
      expect(action.tagName, `${label} should be a link`).toBe("A");
      expect(action).toHaveAttribute("href", href);
    }
  });
});
