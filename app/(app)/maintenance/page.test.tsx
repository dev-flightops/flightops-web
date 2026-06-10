import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FleetAircraftSummary } from "@/lib/api/types";

const { TestApiError, getFleetAirworthiness } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, getFleetAirworthiness: vi.fn() };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/maintenance", () => ({ getFleetAirworthiness }));

import MaintenanceLandingPage from "./page";

function makeSummary(
  overrides: Partial<FleetAircraftSummary> & { id: string; tail: string },
): FleetAircraftSummary {
  return {
    aircraft: { id: overrides.id, tail_number: overrides.tail, model: "C208" },
    is_active: true,
    is_airworthy: true,
    checked_at: "2026-06-15T20:00:00Z",
    blocking_count: 0,
    advisory_count: 0,
    open_mel_count: 0,
    open_squawk_count: 0,
    ...overrides,
  };
}

beforeEach(() => {
  getFleetAirworthiness.mockReset();
});

async function renderPage() {
  const ui = await MaintenanceLandingPage();
  return render(ui);
}

describe("MaintenanceLandingPage", () => {
  it("renders one card per aircraft with the right footer badge", async () => {
    getFleetAirworthiness.mockResolvedValueOnce({
      items: [
        makeSummary({ id: "ac-1", tail: "N101", is_airworthy: false, blocking_count: 1 }),
        makeSummary({ id: "ac-2", tail: "N102", advisory_count: 1 }),
        makeSummary({ id: "ac-3", tail: "N103" }),
      ],
      total: 3,
    });

    await renderPage();

    expect(screen.getByText("N101")).toBeInTheDocument();
    expect(screen.getByText("N102")).toBeInTheDocument();
    expect(screen.getByText("N103")).toBeInTheDocument();

    // One badge per row: Overdue / Due Soon / All items current.
    expect(screen.getByText(/1 overdue/i)).toBeInTheDocument();
    expect(screen.getByText(/1 due soon/i)).toBeInTheDocument();
    expect(screen.getByText(/all items current/i)).toBeInTheDocument();
  });

  it("renders the legacy 'Fleet Management' header + action buttons", async () => {
    getFleetAirworthiness.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(
      screen.getByRole("heading", { name: /fleet management/i, level: 1 }),
    ).toBeInTheDocument();
    // Action button row sourced from MaintenanceHeader
    expect(screen.getByText("Due List")).toBeInTheDocument();
    expect(screen.getByText("+ Aircraft")).toBeInTheDocument();
  });

  it("renders the empty-state copy when the fleet is empty", async () => {
    getFleetAirworthiness.mockResolvedValueOnce({ items: [], total: 0 });

    await renderPage();

    expect(
      screen.getByText(/no aircraft in this tenant/i),
    ).toBeInTheDocument();
  });

  it("renders the session-expired hint on 401", async () => {
    getFleetAirworthiness.mockRejectedValueOnce(
      new TestApiError(
        401,
        "/maintenance/airworthiness/fleet",
        "Unauthorized",
      ),
    );

    await renderPage();

    expect(
      screen.getByText(/session expired/i),
    ).toBeInTheDocument();
  });

  it("renders the generic error hint on other backend failures", async () => {
    getFleetAirworthiness.mockRejectedValueOnce(
      new TestApiError(502, "/maintenance/airworthiness/fleet", "Bad Gateway"),
    );

    await renderPage();

    expect(
      screen.getByText(/maintenance feed unavailable/i),
    ).toBeInTheDocument();
  });
});
