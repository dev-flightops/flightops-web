import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, getAvailability } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { TestApiError, getAvailability: vi.fn() };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/maintenance", () => ({ getAvailability }));

import AvailabilityPage from "./page";

async function show(params: Record<string, string> = {}) {
  render(await AvailabilityPage({ searchParams: Promise.resolve(params) }));
}

const row = {
  aircraft_id: "ac-1",
  tail_number: "N207GE",
  model: "C208",
  airframe_type: "caravan",
  availability_pct: 72.5,
  revenue_hours: 41.2,
  mx_hours: 198,
  non_revenue_hours: 3.5,
  idle_hours: 477.3,
  flights: 22,
  mx_events: 2,
  status: "in_mx",
};

const report = {
  start: "2026-10-08",
  end: "2026-11-06",
  period_days: 30,
  fleet_availability_pct: 91.4,
  revenue_hours: 120.5,
  mx_hours: 198,
  rows: [row, { ...row, aircraft_id: "ac-2", tail_number: "N100PA", availability_pct: 80, status: "on_hold" }, { ...row, aircraft_id: "ac-3", tail_number: "N301PA", availability_pct: 100, status: "available" }],
};

beforeEach(() => {
  getAvailability.mockReset();
});

describe("Aircraft Revenue Availability (#172)", () => {
  it("shows the fleet's figures and the period", async () => {
    getAvailability.mockResolvedValue(report);
    await show();
    expect(getAvailability).toHaveBeenCalledWith({ start: "", end: "" });
    const figures = screen.getByRole("group", { name: "Fleet summary" });
    expect(figures).toHaveTextContent("91.4%Fleet Availability");
    expect(figures).toHaveTextContent("120.5Revenue Hours");
    expect(figures).toHaveTextContent("198Maintenance Hours");
    expect(screen.getByText(/30 day period/)).toBeInTheDocument();
    expect(screen.getByLabelText("From")).toHaveValue("2026-10-08");
    expect(screen.getByLabelText("To")).toHaveValue("2026-11-06");
  });

  it("shows each aircraft, with its colour by legacy's bands", async () => {
    getAvailability.mockResolvedValue(report);
    await show();
    const first = screen.getByRole("row", { name: /N207GE/ });
    expect(within(first).getByText("72.5%").className).toContain("text-status-red");
    expect(within(first).getByText("In MX")).toBeInTheDocument();
    expect(within(first).getByText("41.2")).toBeInTheDocument();
    expect(within(first).getByRole("link", { name: "N207GE" })).toHaveAttribute("href", "/maintenance/aircraft/ac-1");
    const second = screen.getByRole("row", { name: /N100PA/ });
    expect(within(second).getByText("80%").className).toContain("text-status-yellow");
    expect(within(second).getByText("RTS Hold")).toBeInTheDocument();
    const third = screen.getByRole("row", { name: /N301PA/ });
    expect(within(third).getByText("100%").className).toContain("text-status-green");
    expect(within(third).getByText("Available")).toBeInTheDocument();
  });

  it("sends the dates it's given, and ignores anything that isn't one", async () => {
    getAvailability.mockResolvedValue(report);
    await show({ start: "2026-01-01", end: "soon" });
    expect(getAvailability).toHaveBeenCalledWith({ start: "2026-01-01", end: "" });
  });

  it("says what's wrong with a period, and keeps the form", async () => {
    getAvailability.mockRejectedValue(new TestApiError(422, "/availability", JSON.stringify({ detail: "The period's start is after its end." })));
    await show({ start: "2026-02-02", end: "2026-02-01" });
    expect(screen.getByRole("alert")).toHaveTextContent("The period's start is after its end.");
    expect(screen.getByLabelText("From")).toHaveValue("2026-02-02");
  });

  it("says when there's no fleet", async () => {
    getAvailability.mockResolvedValue({ ...report, rows: [] });
    await show();
    expect(screen.getByText("No active aircraft.")).toBeInTheDocument();
  });
});
