import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AirworthinessResponse,
  MelItemResponse,
  SquawkResponse,
} from "@/lib/api/types";

const {
  TestApiError,
  getAirworthiness,
  listMelItems,
  listSquawks,
  notFoundSpy,
} = vi.hoisted(() => {
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
    getAirworthiness: vi.fn(),
    listMelItems: vi.fn(),
    listSquawks: vi.fn(),
    notFoundSpy: vi.fn(() => {
      const err = new Error("NEXT_NOT_FOUND");
      (err as Error & { __notFound?: true }).__notFound = true;
      throw err;
    }),
  };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/maintenance", () => ({
  getAirworthiness,
  listMelItems,
  listSquawks,
}));
vi.mock("next/navigation", () => ({ notFound: notFoundSpy }));

import AircraftDetailPage from "./page";

function makeVerdict(
  overrides: Partial<AirworthinessResponse> = {},
): AirworthinessResponse {
  return {
    aircraft: { id: "ac-1", tail_number: "N207GE", model: "Cessna 208" },
    is_airworthy: true,
    checked_at: "2026-06-15T20:00:00Z",
    blocking_issues: [],
    advisory_issues: [],
    ...overrides,
  };
}

function makeMel(id: string): MelItemResponse {
  return {
    id,
    aircraft: { id: "ac-1", tail_number: "N207GE", model: "Cessna 208" },
    ata_chapter: "21-30",
    description: `MEL ${id}`,
    category: "C",
    deferred_at: "2026-06-01T00:00:00Z",
    due_at: "2026-07-15T00:00:00Z",
    status: "open",
    closed_at: null,
    closed_by: null,
    notes: null,
  };
}

function makeSquawk(id: string, overrides: Partial<SquawkResponse> = {}): SquawkResponse {
  return {
    id,
    aircraft: { id: "ac-1", tail_number: "N207GE", model: "Cessna 208" },
    reported_at: "2026-06-15T14:00:00Z",
    reported_by: { id: "u-1", full_name: "Marie", email: "m@x" },
    title: `Squawk ${id}`,
    description: "...",
    severity: "major",
    status: "open",
    resolved_at: null,
    resolved_by: null,
    resolution_notes: null,
    ...overrides,
  };
}

beforeEach(() => {
  getAirworthiness.mockReset();
  listMelItems.mockReset();
  listSquawks.mockReset();
  notFoundSpy.mockClear();
});

async function renderPage(id = "ac-1") {
  const ui = await AircraftDetailPage({ params: Promise.resolve({ id }) });
  return render(ui);
}

describe("AircraftDetailPage", () => {
  it("renders aircraft tail/model + Airworthy pill when clean", async () => {
    getAirworthiness.mockResolvedValueOnce(makeVerdict());
    listMelItems.mockResolvedValueOnce({ items: [], total: 0 });
    listSquawks
      .mockResolvedValueOnce({ items: [], total: 0 })
      .mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(screen.getByText("N207GE")).toBeInTheDocument();
    expect(screen.getByText("Cessna 208")).toBeInTheDocument();
    expect(screen.getByText(/^airworthy$/i)).toBeInTheDocument();
  });

  it("fetches MEL + open + in_progress squawks for the aircraft", async () => {
    getAirworthiness.mockResolvedValueOnce(makeVerdict());
    listMelItems.mockResolvedValueOnce({ items: [], total: 0 });
    listSquawks
      .mockResolvedValueOnce({ items: [], total: 0 })
      .mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage("ac-42");

    expect(getAirworthiness).toHaveBeenCalledWith("ac-42");
    expect(listMelItems).toHaveBeenCalledWith({
      aircraftId: "ac-42",
      status: "open",
    });
    expect(listSquawks).toHaveBeenNthCalledWith(1, {
      aircraftId: "ac-42",
      status: "open",
    });
    expect(listSquawks).toHaveBeenNthCalledWith(2, {
      aircraftId: "ac-42",
      status: "in_progress",
    });
  });

  it("renders the Grounded pill when blocking issues exist", async () => {
    getAirworthiness.mockResolvedValueOnce(
      makeVerdict({
        is_airworthy: false,
        blocking_issues: [
          {
            kind: "grounding_squawk",
            description: "Hyd press low",
          },
        ],
      }),
    );
    listMelItems.mockResolvedValueOnce({ items: [], total: 0 });
    listSquawks
      .mockResolvedValueOnce({ items: [], total: 0 })
      .mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(screen.getByText(/^grounded$/i)).toBeInTheDocument();
  });

  it("renders MEL items + squawks when present", async () => {
    getAirworthiness.mockResolvedValueOnce(makeVerdict());
    listMelItems.mockResolvedValueOnce({
      items: [makeMel("MEL-A")],
      total: 1,
    });
    listSquawks
      .mockResolvedValueOnce({
        items: [makeSquawk("SQ-A", { title: "Hyd press low" })],
        total: 1,
      })
      .mockResolvedValueOnce({
        items: [makeSquawk("SQ-B", { title: "Wiper cracked", status: "in_progress" })],
        total: 1,
      });

    await renderPage();

    // MEL row appears
    expect(screen.getByText(/MEL MEL-A/i)).toBeInTheDocument();
    // Both squawks (open + in_progress) appear in the table
    expect(screen.getByText("Hyd press low")).toBeInTheDocument();
    expect(screen.getByText("Wiper cracked")).toBeInTheDocument();
  });

  it("calls notFound() when the airworthiness API 404s", async () => {
    getAirworthiness.mockRejectedValueOnce(
      new TestApiError(404, "/maintenance/aircraft/ac-1/airworthiness", ""),
    );
    listMelItems.mockResolvedValueOnce({ items: [], total: 0 });
    listSquawks
      .mockResolvedValueOnce({ items: [], total: 0 })
      .mockResolvedValueOnce({ items: [], total: 0 });

    await expect(renderPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundSpy).toHaveBeenCalledTimes(1);
  });

  it("renders the session-expired alert on 401", async () => {
    getAirworthiness.mockRejectedValueOnce(
      new TestApiError(401, "/maintenance/...", "Unauthorized"),
    );

    await renderPage();

    expect(
      screen.getByText(/session expired/i),
    ).toBeInTheDocument();
  });
});
