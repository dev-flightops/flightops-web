import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ManifestDetailResponse } from "@/lib/api/manifest";
import type { FlightDetail } from "@/lib/api/types";

const { TestApiError, getFlight, getFlightManifest, loadZoneTable } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, getFlight: vi.fn(), getFlightManifest: vi.fn(), loadZoneTable: vi.fn() };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ops", () => ({ getFlight }));
vi.mock("@/lib/api/auth", () => ({ loadZoneTable }));
vi.mock("@/lib/api/manifest", () => ({
  getFlightManifest,
  MAIL_CLASS_LABELS: {
    bypass_mail: "Bypass Mail",
    priority_mail: "Priority Mail",
    first_class: "First Class",
    express_mail: "Express Mail",
  },
}));
const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

import LoadSheetPage from "./page";

const FLIGHT = {
  id: "f-1",
  flight_number: "GVTripleStop",
  origin: "PABE",
  destination: "PABE",
  stops: ["PABE", "PACM", "PAHP", "PABE"],
  legs: [
    { sequence: 1, origin: "PABE", destination: "PACM", scheduled_departure_at: "2026-11-20T18:00:00Z", scheduled_arrival_at: "2026-11-20T18:45:00Z" },
    { sequence: 2, origin: "PACM", destination: "PAHP", scheduled_departure_at: "2026-11-20T19:00:00Z", scheduled_arrival_at: "2026-11-20T19:25:00Z" },
    { sequence: 3, origin: "PAHP", destination: "PABE", scheduled_departure_at: "2026-11-20T19:40:00Z", scheduled_arrival_at: "2026-11-20T20:25:00Z" },
  ],
  scheduled_departure_at: "2026-11-20T18:00:00Z",
  scheduled_arrival_at: "2026-11-20T20:25:00Z",
  status: "released",
  aircraft: { id: "ac-1", tail_number: "N604PA", model: "C208B", seats: 9 },
  pax_count: 3,
  cargo_lbs: 0,
  notes: null,
  max_payload_lbs: 3000,
  released_at: null,
  released_by: null,
} as unknown as FlightDetail;

const row = (over: Record<string, unknown>) => ({
  manifest_id: "m-1",
  weight_lbs: "170.0",
  baggage_lbs: "0.0",
  seat_number: null,
  ticket_type: "revenue",
  is_crew: false,
  is_unaccompanied_minor: false,
  contact_phone: null,
  contact_email: null,
  notes: null,
  check_in_status: "checked_in",
  ...over,
});

const line = (over: Record<string, unknown>) => ({
  manifest_id: "m-1",
  pieces: 1,
  mail_class: null,
  is_hazmat: false,
  hazmat_notes: null,
  shipper: null,
  consignee: null,
  tracking_number: null,
  notes: null,
  ...over,
});

const MANIFEST = {
  id: "m-1",
  flight_id: "f-1",
  status: "final",
  pax: [
    row({
      id: "p-bob",
      first_name: "Bob",
      last_name: "Kalskag",
      weight_lbs: "190.0",
      baggage_lbs: "52.0",
      boards_at: "PABE",
      leaves_at: "PACM",
      bags: [
        { id: "b1", weight_lbs: "40.0", carry_on: false, description: "Blue duffel", status: "aboard" },
        { id: "b2", weight_lbs: "12.0", carry_on: true, description: null, status: "aboard" },
      ],
    }),
    row({ id: "p-alice", first_name: "Alice", last_name: "Northrup", baggage_lbs: "35.0", bags_count: 2, boards_at: "PABE", leaves_at: "PAHP" }),
    row({ id: "p-ella", first_name: "Ella", last_name: "Ramirez", baggage_lbs: "38.0", boards_at: "PABE", leaves_at: "PAVA", check_in_status: "booked" }),
  ],
  cargo: [
    line({ id: "c-1", description: "USPS Priority Mail", mail_class: "priority_mail", weight_lbs: "750.0", pieces: 10, leaves_at: "PACM" }),
    line({ id: "c-2", description: "Generator", weight_lbs: "300.0", is_hazmat: true, hazmat_notes: "Fuel drained", consignee: "Hooper Bay school", leaves_at: "PAHP" }),
  ],
} as unknown as ManifestDetailResponse;

const ZONES = { byIcao: { PABE: "America/Anchorage", PACM: "America/Anchorage", PAHP: "America/Anchorage" }, fallback: "America/Anchorage" };

beforeEach(() => {
  getFlight.mockReset().mockResolvedValue(FLIGHT);
  getFlightManifest.mockReset().mockResolvedValue(MANIFEST);
  loadZoneTable.mockReset().mockResolvedValue(ZONES);
});

async function renderPage() {
  render(await LoadSheetPage({ params: Promise.resolve({ flightId: "f-1" }) }));
}

describe("ramper load sheet (#208)", () => {
  it("lists each stop in order, with what comes off and goes on and its pounds", async () => {
    await renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "GVTripleStop" })).toBeInTheDocument();
    const stops = screen.getAllByRole("listitem", { name: /^Stop / });
    expect(stops.map((s) => s.getAttribute("aria-label"))).toEqual([
      "Stop 1, PABE",
      "Stop 2, PACM",
      "Stop 3, PAHP",
      "Stop 4, PABE",
    ]);

    const chevak = stops[1];
    expect(chevak).toHaveTextContent("lands 09:45 AKST (18:45z) · departs 10:00 AKST (19:00z)");
    const off = within(chevak).getByRole("region", { name: "Off here" });
    expect(off).toHaveTextContent("790 lb bags, mail and freight");
    expect(off).toHaveTextContent("Bob Kalskag");
    expect(off).toHaveTextContent("190 lb + 1 bag, 40 lb · 1 carry-on");
    expect(off).toHaveTextContent("Blue duffel40 lb");
    expect(off).toHaveTextContent("Priority Mail750 lb · 10 pcs");
    expect(within(chevak).getByRole("region", { name: "On here" })).toHaveTextContent("Nothing goes on here.");

    const bethel = within(stops[0]).getByRole("region", { name: "On here" });
    expect(bethel).toHaveTextContent("Alice Northrup");
    expect(bethel).toHaveTextContent("170 lb + 2 bags, 35 lb");
    expect(within(stops[0]).queryByRole("region", { name: "Off here" })).toBeNull();
    expect(within(stops[3]).queryByRole("region", { name: "On here" })).toBeNull();
  });

  it("flags hazmat and names who the freight is for", async () => {
    await renderPage();
    const hooper = within(screen.getByRole("listitem", { name: "Stop 3, PAHP" })).getByRole("region", { name: "Off here" });
    expect(hooper).toHaveTextContent("Generator300 lb · 1 pc");
    expect(hooper).toHaveTextContent("For Hooper Bay school");
    expect(hooper).toHaveTextContent("HAZMAT: Fuel drained — handle with care");
  });

  it("sets apart whoever is on the manifest for a stop the route no longer makes", async () => {
    await renderPage();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Check with dispatch before loading them.");
    expect(within(alert).getByRole("region", { name: "Not on the route" })).toHaveTextContent("Ella Ramirez");
    expect(within(alert).getByRole("region", { name: "Not on the route" })).toHaveTextContent("not checked in");
  });

  it("says when there's no manifest yet, and 404s an unknown flight", async () => {
    getFlightManifest.mockRejectedValue(new TestApiError(404, "/manifest/flights/f-1", "not found"));
    await renderPage();
    expect(screen.getByText("No manifest for this flight yet: nothing to load or pull.")).toBeInTheDocument();
    expect(screen.queryAllByRole("listitem", { name: /^Stop / })).toEqual([]);

    getFlight.mockRejectedValue(new TestApiError(404, "/ops/flights/f-2", "not found"));
    await expect(LoadSheetPage({ params: Promise.resolve({ flightId: "f-2" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
