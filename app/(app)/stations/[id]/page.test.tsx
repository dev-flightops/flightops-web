import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  StationIssueResponse,
  StationListItem,
} from "@/lib/api/types";

const { TestApiError, listStations, listStationIssues, notFoundSpy } =
  vi.hoisted(() => {
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
      listStations: vi.fn(),
      listStationIssues: vi.fn(),
      notFoundSpy: vi.fn(() => {
        throw new Error("NEXT_NOT_FOUND");
      }),
    };
  });
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ground", () => ({ listStations, listStationIssues }));
vi.mock("next/navigation", () => ({ notFound: notFoundSpy }));

// New dialog components use React 19's useActionState which isn't
// available in jsdom. Stub them as passive markers — their actions
// are exercised by the manual QA path.
vi.mock("@/components/stations/report-issue-dialog", () => ({
  ReportIssueDialog: () => <button type="button">+ Report Issue</button>,
}));
vi.mock("@/components/stations/resolve-issue-button", () => ({
  ResolveIssueButton: () => <button type="button">Resolve</button>,
}));

import StationDetailPage from "./page";

function makeStation(overrides: Partial<StationListItem> = {}): StationListItem {
  return {
    id: "s-1",
    icao_code: "PANC",
    name: "Ted Stevens Anchorage Intl",
    city: "Anchorage",
    state: "AK",
    elevation_ft: 152,
    has_reporting_function: true,
    runway_length_ft: 10897,
    runway_width_ft: 200,
    runway_primary_name: "7R/25L",
    runway_source: "faa_api",
    runway_cache_updated_at: "2026-05-01T12:00:00Z",
    latitude: 61.1742,
    longitude: -149.9962,
    notes: null,
    open_issue_count: 2,
    ...overrides,
  };
}

function makeIssue(
  overrides: Partial<StationIssueResponse> = {},
): StationIssueResponse {
  return {
    id: "i-1",
    station: { id: "s-1", icao_code: "PANC", name: "Anchorage" },
    category: "equipment",
    priority: "high",
    status: "open",
    title: "Belt loader hydraulics",
    description: "Loader stalls on heavy boxes; mechanic notified.",
    submitted_by: { id: "u-1", full_name: "Ramp Tester", email: "r@x" },
    submitted_date: "2026-06-08",
    assigned_to: null,
    resolution_notes: null,
    resolved_date: null,
    created_at: "2026-06-08T14:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  listStations.mockReset();
  listStationIssues.mockReset();
  notFoundSpy.mockClear();
});

async function renderPage(id = "s-1") {
  const ui = await StationDetailPage({
    params: Promise.resolve({ id }),
  });
  return render(ui);
}

describe("StationDetailPage (M2-G-38)", () => {
  it("renders the station header with ICAO + name + location", async () => {
    listStations.mockResolvedValueOnce({
      items: [makeStation()],
      total: 1,
    });
    listStationIssues.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(
      screen.getByRole("heading", { name: /PANC/, level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Ted Stevens Anchorage Intl"),
    ).toBeInTheDocument();
    expect(screen.getByText("Anchorage, AK")).toBeInTheDocument();
  });

  it("renders the reporting badge when reporting", async () => {
    listStations.mockResolvedValueOnce({
      items: [makeStation()],
      total: 1,
    });
    listStationIssues.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(screen.getByText(/^reporting$/i)).toBeInTheDocument();
  });

  it("renders open issues section, with the issue title + description", async () => {
    listStations.mockResolvedValueOnce({
      items: [makeStation()],
      total: 1,
    });
    listStationIssues.mockResolvedValueOnce({
      items: [makeIssue()],
      total: 1,
    });

    await renderPage();

    expect(screen.getByText(/open issues \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText("Belt loader hydraulics")).toBeInTheDocument();
    expect(
      screen.getByText(/loader stalls on heavy boxes/i),
    ).toBeInTheDocument();
  });

  it("splits resolved issues into their own section", async () => {
    listStations.mockResolvedValueOnce({
      items: [makeStation()],
      total: 1,
    });
    listStationIssues.mockResolvedValueOnce({
      items: [
        makeIssue(),
        makeIssue({
          id: "i-2",
          title: "Tug coolant leak",
          status: "resolved",
          resolution_notes: "Replaced thermostat.",
          resolved_date: "2026-06-09",
        }),
      ],
      total: 2,
    });

    await renderPage();

    expect(screen.getByText(/open issues \(1\)/i)).toBeInTheDocument();
    expect(
      screen.getByText(/recently resolved \(1\)/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Tug coolant leak")).toBeInTheDocument();
    expect(screen.getByText("Replaced thermostat.")).toBeInTheDocument();
  });

  it("renders the empty open-issues hint when there are none", async () => {
    listStations.mockResolvedValueOnce({
      items: [makeStation({ open_issue_count: 0 })],
      total: 1,
    });
    listStationIssues.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(screen.getByText(/no open issues/i)).toBeInTheDocument();
  });

  it("calls notFound when the station is missing from the list slice", async () => {
    listStations.mockResolvedValueOnce({
      items: [makeStation({ id: "other" })],
      total: 1,
    });
    listStationIssues.mockResolvedValueOnce({ items: [], total: 0 });

    await expect(renderPage("missing")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundSpy).toHaveBeenCalledTimes(1);
  });

  it("renders the session-expired alert on 401", async () => {
    listStations.mockRejectedValueOnce(
      new TestApiError(401, "/ground/stations", "Unauthorized"),
    );
    listStationIssues.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(screen.getByText(/session expired/i)).toBeInTheDocument();
  });

  it("renders the generic error alert on 5xx", async () => {
    listStations.mockRejectedValueOnce(
      new TestApiError(502, "/ground/stations", "Bad Gateway"),
    );
    listStationIssues.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(screen.getByText(/station unavailable/i)).toBeInTheDocument();
  });
});
