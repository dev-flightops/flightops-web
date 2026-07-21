import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  CurrentDutyResponse,
  DutyPeriodSummary,
} from "@/lib/api/types";

const { TestApiError, getCurrentDuty, listDutyHistory } = vi.hoisted(() => {
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
    getCurrentDuty: vi.fn(),
    listDutyHistory: vi.fn(),
  };
});

vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/ops", () => ({ getCurrentDuty, listDutyHistory }));

import TimeClockPage from "./page";

function makeCurrent(overrides: Partial<CurrentDutyResponse> = {}): CurrentDutyResponse {
  return {
    open: null,
    last_closed: null,
    min_rest_hours: 10,
    max_duty_hours: 14,
    warnings: [],
    ...overrides,
  };
}

function makePeriod(overrides: Partial<DutyPeriodSummary> = {}): DutyPeriodSummary {
  return {
    id: "d-1",
    clock_in_at: "2026-07-20T08:00:00Z",
    clock_out_at: "2026-07-20T16:00:00Z",
    elapsed_hours: 8,
    is_open: false,
    rest_acknowledged: true,
    ...overrides,
  };
}

beforeEach(() => {
  getCurrentDuty.mockReset();
  listDutyHistory.mockReset();
});

async function renderPage() {
  const page = await TimeClockPage();
  render(page);
}

describe("/time-clock", () => {
  it("renders 'Not on duty' + empty state when there's no open period + no history", async () => {
    getCurrentDuty.mockResolvedValue(makeCurrent());
    listDutyHistory.mockResolvedValue({ items: [], total: 0 });

    await renderPage();

    expect(screen.getByRole("heading", { name: "Time Clock" })).toBeDefined();
    expect(screen.getByText("Not on duty")).toBeDefined();
    expect(screen.getByText(/No time-clock punches yet/)).toBeDefined();
    expect(
      screen.getByRole("link", { name: /Open Flight Log/ }).getAttribute("href"),
    ).toBe("/flight-crew/elog");
  });

  it("renders on-duty status + max/min rest + Recent Punches when there's data", async () => {
    getCurrentDuty.mockResolvedValue(
      makeCurrent({
        open: makePeriod({
          id: "d-open",
          clock_in_at: "2026-07-20T09:15:00Z",
          clock_out_at: null,
          is_open: true,
          elapsed_hours: 3.5,
        }),
      }),
    );
    listDutyHistory.mockResolvedValue({
      items: [
        makePeriod({ id: "d-1" }),
        makePeriod({
          id: "d-open",
          is_open: true,
          clock_out_at: null,
          elapsed_hours: 3.5,
        }),
      ],
      total: 2,
    });

    await renderPage();

    expect(screen.getByText("On duty")).toBeDefined();
    expect(screen.getByText("14h · 10h")).toBeDefined();
    expect(screen.getByRole("columnheader", { name: "Clock in" })).toBeDefined();
    // Open period status badge
    expect(screen.getByText("Open")).toBeDefined();
    // Closed period status badge
    expect(screen.getByText("Closed")).toBeDefined();
  });

  it("surfaces red/yellow warnings under the status card", async () => {
    getCurrentDuty.mockResolvedValue(
      makeCurrent({
        warnings: [
          { level: "yellow", kind: "approaching", message: "Approaching max duty" },
          { level: "red", kind: "max_duty", message: "Max duty exceeded" },
        ],
      }),
    );
    listDutyHistory.mockResolvedValue({ items: [], total: 0 });

    await renderPage();

    expect(screen.getByText("Approaching max duty")).toBeDefined();
    expect(screen.getByText("Max duty exceeded")).toBeDefined();
  });

  it("shows a friendly error banner on 403", async () => {
    getCurrentDuty.mockRejectedValue(
      new TestApiError(403, "/ops/duty/current", "Forbidden"),
    );
    listDutyHistory.mockResolvedValue({ items: [], total: 0 });

    await renderPage();

    expect(
      screen.getByText(/don't have permission to view time-clock records/),
    ).toBeDefined();
  });
});
