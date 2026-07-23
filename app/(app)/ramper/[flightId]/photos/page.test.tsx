import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FlightDetail } from "@/lib/api/types";

const { TestApiError, getFlight } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, getFlight: vi.fn() };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ops", () => ({ getFlight }));

const { notFoundMock } = vi.hoisted(() => ({ notFoundMock: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }) }));
vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

import RamperPhotosPage from "./page";

function makeFlight(overrides: Partial<FlightDetail> = {}): FlightDetail {
  return {
    id: "f-1",
    flight_number: "GRT201",
    origin: "PANC",
    destination: "PABE",
    scheduled_departure_at: "2026-07-23T18:00:00Z",
    scheduled_arrival_at: "2026-07-23T19:00:00Z",
    status: "scheduled",
    aircraft: {
      id: "ac-1",
      tail_number: "N207GE",
      model: "C208B",
      seats: 9,
      max_payload_lbs: 2000,
      is_active: true,
    },
    pax_count: 5,
    cargo_lbs: 250,
    notes: null,
    max_payload_lbs: 2000,
    released_at: null,
    released_by: null,
    ...overrides,
  } as FlightDetail;
}

beforeEach(() => {
  getFlight.mockReset();
  notFoundMock.mockReset().mockImplementation(() => {
    throw new Error("NEXT_NOT_FOUND");
  });
});

async function renderPage(flightId = "f-1") {
  const page = await RamperPhotosPage({ params: Promise.resolve({ flightId }) });
  render(page);
}

describe("/ramper/[flightId]/photos", () => {
  it("renders flight header + Photos (0) + upload form + required-photo checklist", async () => {
    getFlight.mockResolvedValue(makeFlight());
    await renderPage();

    expect(screen.getByRole("heading", { name: "GRT201" })).toBeDefined();
    expect(screen.getByText(/N207GE · C208B/)).toBeDefined();
    expect(screen.getByText(/Photos \(0\)/)).toBeDefined();
    expect(screen.getByText("No photos yet")).toBeDefined();
    expect(screen.getByRole("combobox")).toBeDefined();
    expect(screen.getByText("Photo Type")).toBeDefined();
    for (const label of ["Secured Load", "Hazmat Placard", "Damage Documentation"]) {
      // Appears twice — once in the <select> option, once in the
      // required-photos checklist.
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(2);
    }
  });

  it("upload controls render disabled with milestone tooltip", async () => {
    getFlight.mockResolvedValue(makeFlight());
    await renderPage();
    const btn = screen.getByRole("button", { name: /Upload photo/i });
    expect(btn.getAttribute("aria-disabled")).toBe("true");
    expect(btn.getAttribute("title") ?? "").toMatch(/ramp-photos backend/);
  });

  it("triggers notFound when the flight id 404s", async () => {
    getFlight.mockRejectedValue(new TestApiError(404, "/ops/flights/x", "Not Found"));
    await expect(renderPage("does-not-exist")).rejects.toThrow(/NEXT_NOT_FOUND/);
    expect(notFoundMock).toHaveBeenCalled();
  });
});
