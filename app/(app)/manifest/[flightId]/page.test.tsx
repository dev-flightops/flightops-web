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

function manifest(status: "draft" | "final") {
  return {
    id: "m-1",
    flight_id: FLIGHT,
    status,
    locked_at: status === "final" ? "2026-11-02T17:40:00Z" : null,
    locked_by_user_id: null,
    notes: null,
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
