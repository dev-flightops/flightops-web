import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
  AirworthinessResponse,
  FlightDetail,
} from "@/lib/api/types";

// vi.mock factories are hoisted above top-level code, so anything they
// reference has to live in vi.hoisted. Same pattern as weather-panel.test:
// we also stub @/lib/api/client to short-circuit the next-auth →
// next/server import chain (vitest can't resolve `next/server` without
// `.js`), and only need `ApiError` as a class shape.
const { TestApiError, getAirworthiness } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, getAirworthiness: vi.fn() };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/maintenance", () => ({ getAirworthiness }));

import { MaintenancePanel } from "./maintenance-panel";

const baseFlight: FlightDetail = {
  id: "f-1",
  flight_number: "GV101",
  origin: "PADU",
  destination: "PANC",
  scheduled_departure_at: "2026-06-07T14:00:00Z",
  scheduled_arrival_at: "2026-06-07T16:00:00Z",
  status: "scheduled",
  aircraft: {
    id: "ac-1",
    tail_number: "N207GE",
    model: "Cessna 208 Caravan",
    seats: 9,
  },
  pax_count: 4,
  cargo_lbs: 200,
  notes: null,
  max_payload_lbs: 3000,
  released_at: null,
  released_by: null,
};

function makeVerdict(
  overrides: Partial<AirworthinessResponse> = {},
): AirworthinessResponse {
  return {
    aircraft: {
      id: "ac-1",
      tail_number: "N207GE",
      model: "Cessna 208 Caravan",
    },
    is_airworthy: true,
    checked_at: "2026-06-07T20:00:00Z",
    blocking_issues: [],
    advisory_issues: [],
    ...overrides,
  };
}

describe("MaintenancePanel", () => {
  it("renders the M2 disabled placeholder when no flight is selected", async () => {
    const ui = await MaintenancePanel({ flight: null });
    render(ui);
    expect(
      screen.getByText(/Pick a flight from the dropdown above/i),
    ).toBeInTheDocument();
    expect(getAirworthiness).not.toHaveBeenCalled();
  });

  it("shows the Airworthy badge + 'clear to dispatch' message when both lists are empty", async () => {
    getAirworthiness.mockReset().mockResolvedValueOnce(makeVerdict());

    const ui = await MaintenancePanel({ flight: baseFlight });
    render(ui);

    expect(getAirworthiness).toHaveBeenCalledWith("ac-1");
    expect(screen.getByText("Airworthy")).toBeInTheDocument();
    expect(screen.getByText(/clear to dispatch/i)).toBeInTheDocument();
  });

  it("renders blocking issues with the Not airworthy badge", async () => {
    getAirworthiness.mockReset().mockResolvedValueOnce(
      makeVerdict({
        is_airworthy: false,
        blocking_issues: [
          {
            kind: "expired_mel",
            description: "MEL 21-30: Cabin pressurization controller intermittent",
            ata_chapter: "21-30",
            days_overdue: 2,
            mel_item_id: "mel-1",
            due_at: "2026-06-05T00:00:00Z",
          },
          {
            kind: "grounding_squawk",
            description: "Engine oil pressure low",
            severity: "grounding",
            squawk_id: "sq-1",
            reported_at: "2026-06-07T18:00:00Z",
          },
        ],
      }),
    );

    const ui = await MaintenancePanel({ flight: baseFlight });
    render(ui);

    expect(screen.getByText("Not airworthy")).toBeInTheDocument();
    expect(
      screen.getByText(/MEL 21-30: Cabin pressurization/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Engine oil pressure low/i)).toBeInTheDocument();
    expect(screen.getByText(/2 days overdue/i)).toBeInTheDocument();
    expect(screen.getByText(/Severity: grounding/i)).toBeInTheDocument();
  });

  it("pluralizes 'day overdue' for 1 day", async () => {
    getAirworthiness.mockReset().mockResolvedValueOnce(
      makeVerdict({
        is_airworthy: false,
        blocking_issues: [
          {
            kind: "expired_mel",
            description: "MEL 32-40: Brake wear",
            ata_chapter: "32-40",
            days_overdue: 1,
          },
        ],
      }),
    );

    const ui = await MaintenancePanel({ flight: baseFlight });
    render(ui);
    expect(screen.getByText(/1 day overdue/)).toBeInTheDocument();
    expect(screen.queryByText(/1 days overdue/)).not.toBeInTheDocument();
  });

  it("renders advisory issues separately and does NOT flip the verdict to not airworthy", async () => {
    getAirworthiness.mockReset().mockResolvedValueOnce(
      makeVerdict({
        is_airworthy: true,
        advisory_issues: [
          {
            kind: "open_mel",
            description: "MEL 21-30: Cabin light",
            ata_chapter: "21-30",
            days_until_due: 5,
            mel_item_id: "mel-1",
          },
          {
            kind: "major_squawk",
            description: "Left main tire wear approaching limits",
            severity: "major",
            squawk_id: "sq-1",
          },
        ],
      }),
    );

    const ui = await MaintenancePanel({ flight: baseFlight });
    render(ui);

    expect(screen.getByText("Airworthy")).toBeInTheDocument();
    expect(screen.getByText(/MEL 21-30: Cabin light/i)).toBeInTheDocument();
    expect(screen.getByText(/due in 5 days/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Left main tire wear/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Severity: major/i)).toBeInTheDocument();
  });

  it("renders both groups side-by-side when blocking AND advisory are present", async () => {
    getAirworthiness.mockReset().mockResolvedValueOnce(
      makeVerdict({
        is_airworthy: false,
        blocking_issues: [
          {
            kind: "grounding_squawk",
            description: "Engine oil pressure low",
            severity: "grounding",
          },
        ],
        advisory_issues: [
          {
            kind: "open_mel",
            description: "MEL 21-30: Cabin light",
            ata_chapter: "21-30",
            days_until_due: 5,
          },
        ],
      }),
    );

    const ui = await MaintenancePanel({ flight: baseFlight });
    render(ui);

    expect(screen.getByText(/Blocking — must clear before release/i)).toBeInTheDocument();
    expect(screen.getByText(/Advisory — surface to crew/i)).toBeInTheDocument();
  });

  it("renders a friendly fallback when the backend errors", async () => {
    getAirworthiness
      .mockReset()
      .mockRejectedValueOnce(
        new TestApiError(
          502,
          "/maintenance/aircraft/ac-1/airworthiness",
          "Bad Gateway",
        ),
      );

    const ui = await MaintenancePanel({ flight: baseFlight });
    render(ui);

    expect(
      screen.getByText(/Maintenance check unavailable/i),
    ).toBeInTheDocument();
  });

  it("renders a specific message when the backend 404s on the aircraft", async () => {
    getAirworthiness
      .mockReset()
      .mockRejectedValueOnce(
        new TestApiError(
          404,
          "/maintenance/aircraft/ac-1/airworthiness",
          "Not Found",
        ),
      );

    const ui = await MaintenancePanel({ flight: baseFlight });
    render(ui);

    expect(
      screen.getByText(/Aircraft not found in the maintenance service/i),
    ).toBeInTheDocument();
  });
});
