import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/api/client", () => ({ ApiError: class extends Error {} }));
vi.mock("@/auth", () => ({ auth: vi.fn(async () => ({ roles: ["dispatcher"] })) }));
vi.mock("@/lib/api/auth", () => ({
  listCompanyBases: vi.fn(async () => ({
    items: [
      { id: "b-1", icao: "9Z8", display_name: "Levelock", is_hub: false },
      { id: "b-2", icao: "PABE", display_name: "Bethel", is_hub: true },
    ],
    total: 2,
  })),
}));
vi.mock("@/lib/api/ops", () => ({
  listFlights: vi.fn(async () => ({
    items: [
      {
        id: "f-1",
        flight_number: "PGR802",
        aircraft: { id: "a-1", tail_number: "N503PA", model: "C208", seats: 9 },
        origin: "PABE",
        destination: "PABE",
        stops: ["PABE", "PAHP", "PACM", "PABE"],
        scheduled_departure_at: "2026-11-25T19:00:00Z",
        scheduled_arrival_at: "2026-11-25T21:30:00Z",
        status: "scheduled",
      },
    ],
    total: 1,
  })),
}));
vi.mock("@/lib/dashboards/operational-snapshot", () => ({
  loadOperationalSnapshot: vi.fn(async () => ({ alerts: [], board: [] })),
  scopeSnapshotToIcao: vi.fn((snapshot: unknown) => snapshot),
}));

import StationDashboardPage from "./page";

afterEach(cleanup);

it("opens on the hub and lists the villages flown today (1124-32)", async () => {
  // It opened on 9Z8 Levelock, first by code, and left out PAHP, PACM
  // and the other villages flown daily.
  render(await StationDashboardPage({ searchParams: Promise.resolve({}) }));
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("PABE");
  for (const icao of ["PAHP", "PACM", "9Z8"]) {
    expect(screen.getAllByText(icao).length).toBeGreaterThan(0);
  }
});
