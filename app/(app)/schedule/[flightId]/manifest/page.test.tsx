import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CrewAssignmentList } from "@/lib/api/crew-assignments";
import type { FlightDetail } from "@/lib/api/types";

const { TestApiError, getFlight, listMyTenants, listFlightCrew } = vi.hoisted(
  () => {
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
      getFlight: vi.fn(),
      listMyTenants: vi.fn(),
      listFlightCrew: vi.fn(),
    };
  },
);

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ops", () => ({ getFlight }));
vi.mock("@/lib/api/auth", () => ({ listMyTenants }));
vi.mock("@/lib/api/crew-assignments", () => ({ listFlightCrew }));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("./print-button", () => ({ PrintButton: () => null }));

import ManifestPage from "./page";

function makeFlight(overrides: Partial<FlightDetail> = {}): FlightDetail {
  return {
    id: "f-1",
    flight_number: "PF201",
    origin: "PANC",
    destination: "PABE",
    scheduled_departure_at: "2026-07-23T18:00:00Z",
    scheduled_arrival_at: "2026-07-23T19:00:00Z",
    status: "scheduled",
    aircraft: {
      id: "ac-1",
      tail_number: "N208PF",
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

function seat(role: "pic" | "sic", fullName: string) {
  return {
    id: `a-${role}`,
    flight_id: "f-1",
    user: { id: `u-${role}`, full_name: fullName, email: `${role}@example.test` },
    crew_role: role,
    assigned_at: "2026-07-22T12:00:00Z",
    assigned_by: null,
    notes: null,
    pic_compliance: null,
  };
}

async function renderPage() {
  render(await ManifestPage({ params: Promise.resolve({ flightId: "f-1" }) }));
}

/** The dd that follows a dt label on the release sheet. */
function fieldValue(label: string): string | null {
  const dt = screen.getByText(label, { selector: "dt" });
  return dt.nextElementSibling?.textContent ?? null;
}

beforeEach(() => {
  getFlight.mockReset().mockResolvedValue(makeFlight());
  listMyTenants.mockReset().mockResolvedValue({ tenants: [] });
  listFlightCrew.mockReset();
});

describe("release sheet crew", () => {
  it("names the flight's PIC and SIC from the crew roster", async () => {
    listFlightCrew.mockResolvedValue({
      items: [seat("pic", "Bob Henderson"), seat("sic", "Alice Chen")],
      has_pic: true,
    } satisfies CrewAssignmentList);
    await renderPage();
    expect(fieldValue("PIC")).toBe("Bob Henderson");
    expect(fieldValue("SIC")).toBe("Alice Chen");
    expect(listFlightCrew).toHaveBeenCalledWith("f-1");
  });

  it("says a PIC is not assigned rather than leaving the line blank", async () => {
    listFlightCrew.mockResolvedValue({ items: [], has_pic: false });
    await renderPage();
    expect(fieldValue("PIC")).toBe("Not assigned");
    expect(fieldValue("SIC")).toBe("—");
  });

  it("still prints the sheet when the roster cannot be read", async () => {
    listFlightCrew.mockRejectedValue(new TestApiError(503, "/crew", "down"));
    await renderPage();
    expect(screen.getByText("PF201")).toBeInTheDocument();
    expect(fieldValue("PIC")).toBe("—");
  });
});
