import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: async () => ({ user: { name: "Demo Admin" }, roles: ["exec_admin"] }) }));
vi.mock("@/lib/api/auth", () => ({
  listMyTenants: async () => ({ tenants: [] }), getCompanyProfile: async () => null,
}));
vi.mock("@/components/home/active-alerts-panel", () => ({ ActiveAlertsPanel: () => null }));
vi.mock("@/components/home/waiting-on-you", () => ({ WaitingOnYou: () => null }));
vi.mock("@/lib/dashboards/operational-snapshot", () => ({
  loadOperationalSnapshot: async () => ({ airborneCount: 3, fleetAirworthy: 5, fleetGrounded: 3,
    board: ["tail-1", "tail-1", "tail-2"].map(id => ({ aircraft: { id }, status: "released",
      actual_departure_at: "2026-11-02T03:00:00Z", actual_arrival_at: null })),
  }),
}));
// An active flag is insufficient: active aircraft can have overdue inspections.
const stats = vi.hoisted(() => vi.fn(async () => ({ aircraft_total: 8, aircraft_active: 7 })));
vi.mock("@/lib/api/ops", () => ({ getFlightStats: stats }));

import HomePage from "./page";

describe("Home fleet figures", () => {
  it("uses maintenance fleet availability rather than the aircraft active flag", async () => {
    render(await HomePage());
    const operation = within(screen.getByRole("group", { name: "Today's operation" }));
    expect(operation.getByText("Aircraft on hold").parentElement).toHaveTextContent("3");
    expect(operation.getByText("On the ground").parentElement).toHaveTextContent("3");
    expect(operation.getByText("Airborne").parentElement).toHaveTextContent("2");
    expect(stats).not.toHaveBeenCalled();
  });
});
