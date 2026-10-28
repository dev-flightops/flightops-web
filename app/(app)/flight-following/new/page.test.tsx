import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCharter, listAircraft } = vi.hoisted(() => ({
  getCharter: vi.fn(),
  listAircraft: vi.fn(),
}));

vi.mock("@/lib/api/client", () => ({ ApiError: class ApiError extends Error {} }));
vi.mock("@/lib/api/charter", () => ({ getCharter }));
vi.mock("@/lib/api/ops", () => ({ listAircraft }));
vi.mock("@/lib/api/auth", () => ({
  getCompanyProfile: vi.fn(async () => ({ ground_minutes: 15 })),
  loadZoneTable: vi.fn(async () => ({ byIcao: {}, fallback: "America/Anchorage" })),
}));
vi.mock("./actions", () => ({ createFlightAction: vi.fn() }));
// Next runs the form on React 19; the test runner has React 18.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: (_action: unknown, initial: unknown) => [initial, () => {}, false],
}));

import FlightFollowingNewPage from "./page";

const field = (name: string) => document.querySelector(`[name="${name}"]`) as HTMLInputElement;

beforeEach(() => {
  listAircraft.mockResolvedValue({
    items: [{ id: "ac-1", tail_number: "N503PA", model: "Cessna 208B", seats: 9, is_active: true }],
  });
});

describe("the new-flight page for a charter (#133)", () => {
  it("starts from the confirmed charter's request", async () => {
    getCharter.mockResolvedValue({
      id: "9868a454-cfa1-46ca-8c26-ed2de62953ee",
      customer_name: "Alice Northrup",
      origin_icao: "PABE",
      destination_icao: "PAII",
      requested_date: "2026-10-25",
      requested_time: "9:30",
      return_date: "2026-10-26",
      pax_count: 5,
      cargo_lbs: "120.0",
      special_requirements: "Two dogs",
      status: "confirmed",
      flight_id: null,
    });
    render(
      await FlightFollowingNewPage({
        searchParams: Promise.resolve({ charter: "9868a454-cfa1-46ca-8c26-ed2de62953ee" }),
      }),
    );
    expect(getCharter).toHaveBeenCalledWith("9868a454-cfa1-46ca-8c26-ed2de62953ee");
    expect(screen.getByRole("note")).toHaveTextContent(
      "The flight for charter CHR-9868A454, Alice Northrup, 5 passengers.",
    );
    expect(screen.getByRole("note")).toHaveTextContent("The return on 2026-10-26 is a flight of its own.");
    expect(field("flight_number")).toHaveValue("CHR-9868A454");
    expect(field("scheduled_departure_at")).toHaveValue("2026-10-25T09:30");
    expect(field("cargo_lbs")).toHaveValue(120);
    expect(field("notes")).toHaveValue("Charter for Alice Northrup. Two dogs");
    expect(field("charter_request_id")).toHaveValue("9868a454-cfa1-46ca-8c26-ed2de62953ee");
  });

  it("says when the charter can't be loaded, and links nothing", async () => {
    getCharter.mockRejectedValue(new Error("404"));
    render(await FlightFollowingNewPage({ searchParams: Promise.resolve({ charter: "nope" }) }));
    expect(screen.getByRole("alert")).toHaveTextContent("won’t be linked to it");
    expect(field("charter_request_id")).toBeNull();
  });
});
