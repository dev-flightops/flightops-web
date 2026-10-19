import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, auth: vi.fn(), getFlight: vi.fn(), getFlightManifest: vi.fn() };
});
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: (_action: unknown, initial: unknown) => [initial, () => {}, false],
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/api/client", () => ({ ApiError: mocks.TestApiError, apiFetch: vi.fn() }));
vi.mock("@/lib/api/ops", () => ({ getFlight: mocks.getFlight }));
vi.mock("@/lib/api/manifest", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/manifest")>()),
  getFlightManifest: mocks.getFlightManifest,
}));
vi.mock("./actions", () => ({
  savePaxAction: vi.fn(),
  saveFreightAction: vi.fn(),
  removeLineAction: vi.fn(),
  createManifestAction: vi.fn(),
  lockManifestAction: vi.fn(),
  savePlannedFuelAction: vi.fn(),
}));

import FlightManifestPage from "./page";

const FLIGHT = "6b0f6a3e-2c1d-4e5f-8a9b-0c1d2e3f4a5b";

const flight = {
  id: FLIGHT,
  flight_number: "PGR901",
  origin: "PANC",
  destination: "PABE",
  status: "scheduled",
  aircraft: { id: "a-1", tail_number: "N100PA", model: "Cessna 208 Caravan", seats: 9 },
  max_payload_lbs: 3000,
};

type Load = {
  useful_load_lbs: number | null;
  crew_lbs: string;
  crew_basis: "manifest" | "standard" | "none";
  crew_count: number;
  fuel_lbs: string | null;
  payload_lbs: string;
  remaining_lbs: string | null;
  fuel_counted: boolean;
};

const BEFORE_FUEL: Load = {
  useful_load_lbs: 3000,
  crew_lbs: "190",
  crew_basis: "standard",
  crew_count: 1,
  fuel_lbs: null,
  payload_lbs: "228.0",
  remaining_lbs: "2582.0",
  fuel_counted: false,
};

function manifest(status: "draft" | "final", load: Load = BEFORE_FUEL) {
  return {
    id: "m-1",
    flight_id: FLIGHT,
    status,
    locked_at: status === "final" ? "2026-11-02T17:40:00Z" : null,
    locked_by_user_id: null,
    notes: null,
    planned_fuel_lbs: load.fuel_lbs,
    load,
    pax: [
      {
        id: "p-1",
        manifest_id: "m-1",
        first_name: "Ann",
        last_name: "Quill",
        weight_lbs: "152.0",
        baggage_lbs: "20.0",
        seat_number: "1A",
        ticket_type: "revenue",
        is_crew: false,
        is_unaccompanied_minor: false,
        contact_phone: null,
        contact_email: null,
        notes: null,
      },
    ],
    cargo: [
      { id: "c-1", manifest_id: "m-1", description: "USPS Bypass Mail", weight_lbs: "40.5", pieces: 3, mail_class: "bypass_mail", is_hazmat: false, hazmat_notes: null, shipper: null, consignee: null, tracking_number: null, notes: null },
      { id: "c-2", manifest_id: "m-1", description: "UPS package", weight_lbs: "15.5", pieces: 1, mail_class: null, is_hazmat: false, hazmat_notes: null, shipper: null, consignee: null, tracking_number: "1Z999", notes: null },
    ],
    totals: {
      pax_count: 1,
      revenue_pax: 1,
      crew_count: 0,
      pax_weight_lbs: "152.0",
      baggage_weight_lbs: "20.0",
      crew_weight_lbs: "0.0",
      cargo_weight_lbs: "15.5",
      mail_weight_lbs: "40.5",
      total_payload_lbs: "228.0",
    },
  };
}

async function renderPage() {
  render(await FlightManifestPage({ params: Promise.resolve({ flightId: FLIGHT }) }));
}

function section(title: string): HTMLElement {
  return screen.getByRole("heading", { name: title }).closest("section") as HTMLElement;
}

beforeEach(() => {
  mocks.auth.mockReset();
  mocks.getFlight.mockReset().mockResolvedValue(flight);
  mocks.getFlightManifest.mockReset();
});

describe("manifest entry (#62)", () => {
  it("lets a check-in role build and lock a draft, with mail and cargo apart as legacy has them", async () => {
    mocks.auth.mockResolvedValue({ roles: ["dispatcher"] });
    mocks.getFlightManifest.mockResolvedValue(manifest("draft"));
    await renderPage();
    expect(screen.getByRole("button", { name: "Lock Manifest" })).toBeTruthy();
    expect(screen.getByText("Crew Weight")).toBeTruthy();
    expect(within(section("Passengers & Crew")).getByRole("button", { name: "+ Add Passenger" })).toBeTruthy();
    const mail = section("USPS Mail");
    expect(within(mail).getByText("USPS Bypass Mail")).toBeTruthy();
    expect(within(mail).queryByText("UPS package")).toBeNull();
    const cargo = section("Cargo & Freight");
    expect(within(cargo).getByText("UPS package")).toBeTruthy();
    expect(within(cargo).getByText("1Z999")).toBeTruthy();
  });

  it("lets anyone on staff build the manifest, but not lock it", async () => {
    mocks.auth.mockResolvedValue({ roles: ["pilot"] });
    mocks.getFlightManifest.mockResolvedValue(manifest("draft"));
    await renderPage();
    expect(screen.queryByRole("button", { name: "Lock Manifest" })).toBeNull();
    expect(screen.getByRole("button", { name: "+ Add Cargo" })).toBeTruthy();
  });

  it("shows a locked manifest as final, with nothing to change", async () => {
    mocks.auth.mockResolvedValue({ roles: ["exec_admin"] });
    mocks.getFlightManifest.mockResolvedValue(manifest("final"));
    await renderPage();
    expect(screen.getByText("Manifest locked.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Lock Manifest" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^\+ Add/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.getByText("Quill")).toBeTruthy();
  });

  it("offers to create the manifest when the flight has none", async () => {
    mocks.auth.mockResolvedValue({ roles: ["pilot"] });
    mocks.getFlightManifest.mockRejectedValue(new mocks.TestApiError(404, "/manifest", "manifest not created yet"));
    await renderPage();
    expect(screen.getByText("No manifest created for this flight yet.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create Manifest" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Lock Manifest" })).toBeNull();
  });
});

describe("weight left for mail and freight (#74)", () => {
  function panel(): HTMLElement {
    return screen.getByRole("region", { name: "Load" });
  }

  it("says the figure is before fuel until the planned fuel is entered", async () => {
    mocks.auth.mockResolvedValue({ roles: ["dispatcher"] });
    mocks.getFlightManifest.mockResolvedValue(manifest("draft"));
    await renderPage();
    const load = within(panel());
    expect(load.getByText("Left before fuel")).toBeTruthy();
    expect(load.getByText("2,582 lb")).toBeTruthy();
    expect(load.getByText("not entered")).toBeTruthy();
    expect(load.getByText("1 assigned, at standard weight")).toBeTruthy();
    expect(load.getByText(/Fuel isn’t counted yet\./)).toBeTruthy();
    expect(load.getByRole("textbox", { name: "Planned fuel (lb)" })).toBeTruthy();
    // The old headroom figure, useful load minus payload only, is gone.
    expect(screen.queryByText("Headroom")).toBeNull();
  });

  it("takes crew and planned fuel off the useful load", async () => {
    mocks.auth.mockResolvedValue({ roles: ["dispatcher"] });
    mocks.getFlightManifest.mockResolvedValue(
      manifest("draft", { ...BEFORE_FUEL, fuel_lbs: "1005.0", remaining_lbs: "1577.0", fuel_counted: true }),
    );
    await renderPage();
    const load = within(panel());
    expect(load.getByText("Left for mail & freight")).toBeTruthy();
    expect(load.getByText("1,577 lb")).toBeTruthy();
    expect(load.getByText("1,005 lb")).toBeTruthy();
    expect(load.getByText("planned")).toBeTruthy();
    expect(load.queryByText(/Fuel isn’t counted yet/)).toBeNull();
    expect((load.getByRole("textbox", { name: "Planned fuel (lb)" }) as HTMLInputElement).defaultValue).toBe("1005");
  });

  it("shows how far over the useful load it is", async () => {
    mocks.auth.mockResolvedValue({ roles: ["dispatcher"] });
    mocks.getFlightManifest.mockResolvedValue(
      manifest("draft", { ...BEFORE_FUEL, fuel_lbs: "2700.0", remaining_lbs: "-118.0", fuel_counted: true }),
    );
    await renderPage();
    const load = within(panel());
    expect(load.getByText("Over the useful load by")).toBeTruthy();
    expect(load.getByText("118 lb").className).toContain("text-status-red");
  });

  it("keeps the fuel with a locked manifest, read only", async () => {
    mocks.auth.mockResolvedValue({ roles: ["dispatcher"] });
    mocks.getFlightManifest.mockResolvedValue(
      manifest("final", { ...BEFORE_FUEL, fuel_lbs: "1005.0", remaining_lbs: "1577.0", fuel_counted: true }),
    );
    await renderPage();
    const load = within(panel());
    expect(load.getByText("1,005 lb")).toBeTruthy();
    expect(load.queryByRole("textbox", { name: "Planned fuel (lb)" })).toBeNull();
  });

  it("asks for the aircraft's useful load when it isn't set", async () => {
    mocks.auth.mockResolvedValue({ roles: ["dispatcher"] });
    mocks.getFlightManifest.mockResolvedValue(manifest("draft", { ...BEFORE_FUEL, useful_load_lbs: null, remaining_lbs: null }));
    await renderPage();
    expect(within(panel()).getByText(/Set this aircraft’s useful load in Settings → Aircraft/)).toBeTruthy();
  });

  it("still renders against an ops build that sends no breakdown", async () => {
    mocks.auth.mockResolvedValue({ roles: ["dispatcher"] });
    const { load: _load, planned_fuel_lbs: _fuel, ...older } = manifest("draft");
    mocks.getFlightManifest.mockResolvedValue(older);
    await renderPage();
    expect(screen.queryByRole("region", { name: "Load" })).toBeNull();
    expect(screen.getByText("Total Payload")).toBeTruthy();
  });

  it("weighs crew on the manifest as entered", async () => {
    mocks.auth.mockResolvedValue({ roles: ["dispatcher"] });
    mocks.getFlightManifest.mockResolvedValue(manifest("draft", { ...BEFORE_FUEL, crew_basis: "manifest", crew_lbs: "200.0" }));
    await renderPage();
    expect(within(panel()).getByText("as weighed on the manifest")).toBeTruthy();
  });
});
