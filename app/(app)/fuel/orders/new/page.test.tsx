import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, listAircraft, listFlights, listFuelSuppliers, listFuelTypes, loadZoneTable } = vi.hoisted(() => ({
  auth: vi.fn(),
  listAircraft: vi.fn(),
  listFlights: vi.fn(),
  listFuelSuppliers: vi.fn(),
  listFuelTypes: vi.fn(),
  loadZoneTable: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/api/ops", () => ({ listAircraft, listFlights }));
vi.mock("@/lib/api/ground", () => ({ listFuelSuppliers, listFuelTypes }));
vi.mock("@/lib/api/auth", () => ({ loadZoneTable }));
vi.mock("./new-order-form", () => ({ NewFuelOrderForm: () => <form aria-label="Order fuel form" /> }));

import NewFuelOrderPage from "./page";

const flight = {
  id: "fl-107",
  flight_number: "DEMO107",
  origin: "PABE",
  destination: "PANC",
  scheduled_departure_at: "2026-11-03T14:25:00Z",
  aircraft: { tail_number: "N94DM" },
};

beforeEach(() => {
  for (const f of [auth, listAircraft, listFlights, listFuelSuppliers, listFuelTypes, loadZoneTable]) f.mockReset();
  loadZoneTable.mockResolvedValue({ byIcao: {}, fallback: "America/Anchorage" });
  listAircraft.mockResolvedValue({ items: [], total: 0 });
  listFuelSuppliers.mockResolvedValue({ items: [], total: 0 });
  listFuelTypes.mockResolvedValue({ items: [], total: 0 });
  listFlights.mockResolvedValue({ items: [flight], total: 1 });
});

describe("Order Fuel (#134)", () => {
  it("sends a pilot to the flights they crew: their orders are for a flight", async () => {
    auth.mockResolvedValue({ roles: ["pilot"] });
    render(await NewFuelOrderPage());
    expect(screen.getByRole("link", { name: /DEMO107 PABE → PANC/ })).toHaveAttribute("href", "/flight-crew/preflight/fl-107");
    expect(screen.getByText(/departs 05:25 AKST/)).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Order fuel form" })).toBeNull();
    expect(listFlights).toHaveBeenCalledWith(expect.objectContaining({ assignedToMe: true }));
  });

  it("gives a chief pilot (a pilot with another ordering role) the form", async () => {
    auth.mockResolvedValue({ roles: ["chief_pilot", "pilot"] });
    render(await NewFuelOrderPage());
    expect(screen.getByRole("form", { name: "Order fuel form" })).toBeInTheDocument();
    expect(listFlights).not.toHaveBeenCalled();
  });
});
