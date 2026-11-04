import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const { listFlights, loadZoneTable } = vi.hoisted(() => ({ listFlights: vi.fn(), loadZoneTable: vi.fn() }));
vi.mock("@/lib/api/ops", () => ({ listFlights }));
vi.mock("@/lib/api/auth", () => ({ loadZoneTable }));
vi.mock("@/lib/api/client", () => ({ ApiError: class extends Error {} }));
import FlightSchedulePage from "./page";

beforeEach(() => {
  loadZoneTable.mockResolvedValue({ byIcao: {}, fallback: "America/Anchorage" });
  listFlights.mockResolvedValue({ items: [{
    id: "round-trip", flight_number: "DEMO103", origin: "PANC", destination: "PANC",
    stops: ["PANC", "PABE", "PANC"], status: "released",
    scheduled_departure_at: "2026-11-04T08:14:00Z", scheduled_arrival_at: "2026-11-04T09:14:00Z",
    aircraft: { id: "aircraft-1", tail_number: "N93DM", model: "Caravan", seats: 9 },
  }] });
});

it("keeps the village stop visible on a return flight in the manifest schedule", async () => {
  render(await FlightSchedulePage({ searchParams: Promise.resolve({ range: "all" }) }));
  expect(screen.getByRole("cell", { name: "PANC → PABE → PANC" })).toBeInTheDocument();
  expect(screen.queryByRole("cell", { name: "PANC → PANC" })).not.toBeInTheDocument();
});
