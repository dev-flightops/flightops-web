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
  return {
    TestApiError,
    auth: vi.fn(),
    getFlight: vi.fn(),
    getFlightManifest: vi.fn(),
    getLoadPlan: vi.fn(),
    // What a form's last submit returned; tests that need one set it.
    actionState: { current: undefined as unknown },
  };
});
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: (_action: unknown, initial: unknown) => [mocks.actionState.current ?? initial, () => {}, false],
}));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/api/client", () => ({ ApiError: mocks.TestApiError, apiFetch: vi.fn() }));
vi.mock("@/lib/api/ops", () => ({ getFlight: mocks.getFlight }));
vi.mock("@/lib/api/manifest", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/manifest")>()),
  getFlightManifest: mocks.getFlightManifest,
  getLoadPlan: mocks.getLoadPlan,
}));
vi.mock("./actions", () => ({
  savePaxAction: vi.fn(),
  saveFreightAction: vi.fn(),
  removeLineAction: vi.fn(),
  createManifestAction: vi.fn(),
  lockManifestAction: vi.fn(),
  savePlannedFuelAction: vi.fn(),
  applyLoadPlanAction: vi.fn(),
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
  mocks.getLoadPlan.mockReset().mockRejectedValue(new mocks.TestApiError(404, "/manifest", "not found"));
  mocks.actionState.current = undefined;
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

  it("lets a pilot build the manifest, but not lock it", async () => {
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

describe("the accountant reads manifests (#128)", () => {
  it("shows a draft with nothing to change, as legacy's bookkeeper had it", async () => {
    mocks.auth.mockResolvedValue({ roles: ["accountant"] });
    mocks.getFlightManifest.mockResolvedValue(manifest("draft"));
    await renderPage();
    expect(screen.getByText("Quill")).toBeTruthy();
    expect(screen.getByText("UPS package")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Lock Manifest" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^\+ Add/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save Fuel" })).toBeNull();
  });

  it("shows what is waiting without offering to load it", async () => {
    mocks.auth.mockResolvedValue({ roles: ["accountant"] });
    mocks.getFlightManifest.mockResolvedValue(manifest("draft"));
    mocks.getLoadPlan.mockResolvedValue({
      flight_id: FLIGHT,
      origin: "PANC",
      destinations: ["PABE"],
      load: BEFORE_FUEL,
      waiting: [
        { id: "w-2", station_icao: "PANC", destination_icao: "PABE", mail_class: "priority_mail", description: "USPS Priority Mail", weight_lbs: "150.0", pieces: 3, shipper: null, consignee: null, notes: null, status: "waiting", received_at: "2026-10-20T17:00:00Z" },
      ],
      suggestion: [
        { waiting_load_id: "w-2", description: "USPS Priority Mail", mail_class: "priority_mail", weight_lbs: "150.0", pieces: 3, of_weight_lbs: "150.0", of_pieces: 3 },
      ],
      suggested_lbs: "150.0",
      left_after_lbs: "400.0",
      blocked: null,
    });
    await renderPage();
    const w = within(screen.getByRole("region", { name: "Mail and freight waiting" }));
    expect(w.getByText("1 entry waiting, 150 lb.")).toBeTruthy();
    expect(w.queryByRole("button")).toBeNull();
  });

  it("doesn't offer a manifest to create", async () => {
    mocks.auth.mockResolvedValue({ roles: ["accountant"] });
    mocks.getFlightManifest.mockRejectedValue(new mocks.TestApiError(404, "/manifest", "manifest not created yet"));
    await renderPage();
    expect(screen.getByText("No manifest created for this flight yet.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Create Manifest" })).toBeNull();
  });

  it("lets a bookkeeper who also dispatches build it", async () => {
    mocks.auth.mockResolvedValue({ roles: ["accountant", "dispatcher"] });
    mocks.getFlightManifest.mockResolvedValue(manifest("draft"));
    await renderPage();
    expect(screen.getByRole("button", { name: "+ Add Cargo" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Lock Manifest" })).toBeTruthy();
  });
});

describe("pickups by stop (#120)", () => {
  it("shows the seats on each leg of a flight with stops, and asks where each boards", async () => {
    mocks.auth.mockResolvedValue({ roles: ["dispatcher"] });
    mocks.getFlight.mockResolvedValue({ ...flight, origin: "PABE", destination: "PABE", stops: ["PABE", "PAVA", "PAHP", "PABE"] });
    mocks.getFlightManifest.mockResolvedValue({
      ...manifest("draft"),
      legs: [
        { origin: "PABE", destination: "PAVA", held: 0, open: 9 },
        { origin: "PAVA", destination: "PAHP", held: 5, open: 4 },
        { origin: "PAHP", destination: "PABE", held: 9, open: 0 },
      ],
    });
    await renderPage();
    const seats = screen.getByRole("region", { name: "Seats by leg" });
    const rows = within(seats).getAllByRole("row").slice(1);
    expect(rows.map((r) => r.textContent)).toEqual(["1  PABE → PAVA09", "2  PAVA → PAHP54", "3  PAHP → PABE90"]);
    expect(within(section("Passengers & Crew")).getByText("PABE → PABE")).toBeTruthy();
    // #132: the header names every stop; a round trip read "PABE → PABE".
    expect(screen.getByText(/^PABE → PAVA → PAHP → PABE/)).toBeInTheDocument();
  });

  it("has no leg table for a flight of one leg", async () => {
    mocks.auth.mockResolvedValue({ roles: ["dispatcher"] });
    mocks.getFlightManifest.mockResolvedValue({
      ...manifest("draft"),
      legs: [{ origin: "PANC", destination: "PABE", held: 1, open: 8 }],
    });
    await renderPage();
    expect(screen.queryByRole("region", { name: "Seats by leg" })).toBeNull();
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

describe("the trip's fuel and what is waiting for the route (#75)", () => {
  const ESTIMATE = {
    lbs: "1005",
    gallons: "149.9",
    burn_gph: "58",
    fuel_type_code: "jet_a",
    flight_minutes: 55,
    round_trip: true,
    reserve_minutes: 45,
    missing: [],
  };
  const ESTIMATED = {
    ...BEFORE_FUEL,
    fuel_lbs: "1005",
    remaining_lbs: "1577.0",
    fuel_counted: true,
    fuel_basis: "estimated" as const,
    fuel_estimate: ESTIMATE,
  };

  function plan(overrides: Record<string, unknown> = {}) {
    return {
      flight_id: FLIGHT,
      origin: "PANC",
      destinations: ["PABE"],
      load: ESTIMATED,
      waiting: [
        { id: "w-1", station_icao: "PANC", destination_icao: "PABE", mail_class: "bypass_mail", description: "USPS Bypass Mail", weight_lbs: "2000.0", pieces: 40, shipper: null, consignee: null, notes: null, status: "waiting", received_at: "2026-10-20T16:00:00Z" },
        { id: "w-2", station_icao: "PANC", destination_icao: "PABE", mail_class: "priority_mail", description: "USPS Priority Mail", weight_lbs: "150.0", pieces: 3, shipper: null, consignee: null, notes: null, status: "waiting", received_at: "2026-10-20T17:00:00Z" },
      ],
      suggestion: [
        { waiting_load_id: "w-2", description: "USPS Priority Mail", mail_class: "priority_mail", weight_lbs: "150.0", pieces: 3, of_weight_lbs: "150.0", of_pieces: 3 },
        { waiting_load_id: "w-1", description: "USPS Bypass Mail", mail_class: "bypass_mail", weight_lbs: "1400.0", pieces: 28, of_weight_lbs: "2000.0", of_pieces: 40 },
      ],
      suggested_lbs: "1550.0",
      left_after_lbs: "27.0",
      blocked: null,
      ...overrides,
    };
  }

  function waiting(): HTMLElement {
    return screen.getByRole("region", { name: "Mail and freight waiting" });
  }

  it("shows the estimate's working when dispatch hasn't entered fuel", async () => {
    mocks.auth.mockResolvedValue({ roles: ["dispatcher"] });
    mocks.getFlightManifest.mockResolvedValue(manifest("draft", ESTIMATED));
    await renderPage();
    const load = within(screen.getByRole("region", { name: "Load" }));
    expect(load.getByText("estimated")).toBeTruthy();
    expect(load.getByText("1,577 lb")).toBeTruthy();
    expect(
      load.getByText(
        /Fuel estimated: round trip, 55 min each way \(no Jet A at the destination\) \+ 45 min reserve at 58 gal\/h = 149\.9 gal of Jet A\./,
      ),
    ).toBeTruthy();
  });

  it("says what the estimate needs when it can't be had", async () => {
    mocks.auth.mockResolvedValue({ roles: ["dispatcher"] });
    mocks.getFlightManifest.mockResolvedValue(
      manifest("draft", {
        ...BEFORE_FUEL,
        fuel_basis: null,
        fuel_estimate: { ...ESTIMATE, lbs: null, gallons: null, missing: ["the fuel burn for C208B (Settings → Costs)"] },
      } as never),
    );
    await renderPage();
    expect(
      screen.getByText(
        "Fuel isn’t counted yet. Enter the planned fuel, or set the fuel burn for C208B (Settings → Costs) to have it estimated.",
      ),
    ).toBeTruthy();
  });

  it("suggests the fill and offers to load it", async () => {
    mocks.auth.mockResolvedValue({ roles: ["dispatcher"] });
    mocks.getFlightManifest.mockResolvedValue(manifest("draft", ESTIMATED));
    mocks.getLoadPlan.mockResolvedValue(plan());
    await renderPage();
    const w = within(waiting());
    expect(w.getByRole("heading", { name: "Waiting at PANC for PABE" })).toBeTruthy();
    expect(w.getByText("2 entries waiting, 2,150 lb.")).toBeTruthy();
    expect(w.getByText("1,400 of 2,000 lb")).toBeTruthy();
    expect(w.getByText("28 of 40")).toBeTruthy();
    expect(w.getByText(/Suggested 1,550 lb · 27 lb left after\./)).toBeTruthy();
    expect(w.getByRole("button", { name: "Load 1,550 lb onto PGR901" })).toBeTruthy();
    expect(w.getByRole("link", { name: /All waiting mail & freight/ }).getAttribute("href")).toBe(
      "/manifest/waiting?station=PANC",
    );
  });

  it("explains why nothing is suggested", async () => {
    mocks.auth.mockResolvedValue({ roles: ["dispatcher"] });
    mocks.getFlightManifest.mockResolvedValue(manifest("draft"));
    mocks.getLoadPlan.mockResolvedValue(plan({ suggestion: [], suggested_lbs: "0", blocked: "fuel_unknown" }));
    await renderPage();
    const w = within(waiting());
    expect(w.getByText(/Enter the planned fuel above, or set up the fuel estimate/)).toBeTruthy();
    expect(w.queryByRole("button")).toBeNull();
  });

  it("offers no loading on a locked manifest", async () => {
    mocks.auth.mockResolvedValue({ roles: ["dispatcher"] });
    mocks.getFlightManifest.mockResolvedValue(manifest("final", ESTIMATED));
    mocks.getLoadPlan.mockResolvedValue(plan({ suggestion: [], blocked: "locked" }));
    await renderPage();
    expect(within(waiting()).getByText("The manifest is locked, so nothing more goes on.")).toBeTruthy();
  });

  it("names a mail class only where the description doesn't already say it", async () => {
    mocks.auth.mockResolvedValue({ roles: ["dispatcher"] });
    mocks.getFlightManifest.mockResolvedValue(manifest("draft", ESTIMATED));
    const [priority, bypass] = plan().suggestion;
    mocks.getLoadPlan.mockResolvedValue(plan({ suggestion: [priority, { ...bypass, description: "School lunch program" }] }));
    await renderPage();
    const rows = within(waiting()).getAllByRole("row");
    expect(rows[1].textContent).toContain("USPS Priority Mail");
    expect(rows[1].textContent).not.toContain("USPS Priority MailPriority Mail");
    expect(rows[2].textContent).toContain("School lunch programBypass Mail");
  });

  it("says nothing waiting fits when some weight is left", async () => {
    mocks.auth.mockResolvedValue({ roles: ["dispatcher"] });
    mocks.getFlightManifest.mockResolvedValue(manifest("draft", ESTIMATED));
    mocks.getLoadPlan.mockResolvedValue(
      plan({ load: { ...ESTIMATED, remaining_lbs: "5.0" }, suggestion: [], suggested_lbs: "0", blocked: "no_room" }),
    );
    await renderPage();
    expect(within(waiting()).getByText("Nothing waiting fits in the 5 lb left.")).toBeTruthy();
  });

  it("keeps saying what was loaded once the suggestion is gone", async () => {
    mocks.auth.mockResolvedValue({ roles: ["dispatcher"] });
    mocks.getFlightManifest.mockResolvedValue(manifest("draft", ESTIMATED));
    mocks.getLoadPlan.mockResolvedValue(
      plan({ load: { ...ESTIMATED, remaining_lbs: "5.0" }, suggestion: [], suggested_lbs: "0", blocked: "no_room" }),
    );
    mocks.actionState.current = { status: "ok", message: "Loaded 1,550 lb onto PGR901.", attempt: 1 };
    await renderPage();
    const w = within(waiting());
    expect(w.getByRole("status").textContent).toBe("Loaded 1,550 lb onto PGR901.");
    expect(w.queryByRole("button")).toBeNull();
  });

  it("says when nothing is waiting for the route", async () => {
    mocks.auth.mockResolvedValue({ roles: ["dispatcher"] });
    mocks.getFlightManifest.mockResolvedValue(manifest("draft", ESTIMATED));
    mocks.getLoadPlan.mockResolvedValue(plan({ waiting: [], suggestion: [], blocked: "nothing_waiting" }));
    await renderPage();
    expect(within(waiting()).getByText("Nothing is waiting at PANC for PABE.")).toBeTruthy();
  });
});
