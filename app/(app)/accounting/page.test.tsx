import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAccountingSummary, getAgingReport } = vi.hoisted(() => ({
  getAccountingSummary: vi.fn(),
  getAgingReport: vi.fn(),
}));

vi.mock("@/lib/api/client", () => ({ ApiError: class extends Error {} }));
vi.mock("@/lib/api/reports", () => ({ getAccountingSummary }));
vi.mock("@/lib/api/customer-invoices", () => ({ getAgingReport }));
vi.mock("@/components/reports/period-controls", () => ({ PeriodControls: () => null }));

import AccountingPage, { monthEndIfPast } from "./page";

function summary(over = {}) {
  return {
    year: 2026, month: 8, period_label: "August 2026",
    period_start: "2026-08-01", period_end: "2026-08-31", time_zone: "America/Anchorage",
    booked_cents: 100000, invoiced_cents: 50000, collected_cents: 20000,
    cost_cents: 30000, profit_cents: 70000, margin_pct: 70,
    uninvoiced_cents: 50000, uninvoiced_flights: 2, block_hours: 3,
    confidence: { flights: 3, unpriced_flights: 0, unhoured_flights: 0 },
    note: "",
    ...over,
  };
}

const aging = {
  as_of: "2026-08-31", invoices: [], buckets: [], total_outstanding_cents: 0,
  undated_count: 0, undated_cents: 0, note: "",
};

beforeEach(() => {
  vi.clearAllMocks();
  getAccountingSummary.mockResolvedValue(summary());
  getAgingReport.mockResolvedValue(aging);
});

describe("/accounting month-end (#29)", () => {
  it("ages a past month as of its last day", async () => {
    render(await AccountingPage({ searchParams: Promise.resolve({ year: "2026", month: "8" }) }));
    expect(getAgingReport).toHaveBeenCalledWith("2026-08-31");
  });

  it("ages the current month as of today", async () => {
    render(await AccountingPage({ searchParams: Promise.resolve({}) }));
    expect(getAgingReport).toHaveBeenCalledWith(undefined);
  });

  it("names the flights flown with no invoice sent and links to Invoicing", async () => {
    render(await AccountingPage({ searchParams: Promise.resolve({ year: "2026", month: "8" }) }));
    expect(screen.getByRole("status")).toHaveTextContent("2 flights flown with no invoice sent");
    expect(
      screen.getByRole("link", { name: "Raise or send them from Invoicing" }).getAttribute("href"),
    ).toBe("/invoicing");
  });

  it("monthEndIfPast: the last day of a past month, nothing for this month or later", () => {
    const now = new Date(Date.UTC(2026, 9, 5));
    expect(monthEndIfPast(2026, 9, "UTC", now)).toBe("2026-09-30");
    expect(monthEndIfPast(2026, 2, "UTC", now)).toBe("2026-02-28");
    expect(monthEndIfPast(2025, 12, "UTC", now)).toBe("2025-12-31");
    expect(monthEndIfPast(2026, 10, "UTC", now)).toBeUndefined();
    expect(monthEndIfPast(2026, 11, "UTC", now)).toBeUndefined();
  });
});

describe("/accounting in the company's month (#128)", () => {
  it("monthEndIfPast: October is not past on its last evening in Alaska", () => {
    // 21:00 AKDT on 31 October is 05:00Z on 1 November.
    const now = new Date(Date.UTC(2026, 10, 1, 5));
    expect(monthEndIfPast(2026, 10, "America/Anchorage", now)).toBeUndefined();
    expect(monthEndIfPast(2026, 10, "UTC", now)).toBe("2026-10-31");
  });

  it("says where the month ends, and that Invoiced is what was sent", async () => {
    render(await AccountingPage({ searchParams: Promise.resolve({ year: "2026", month: "8" }) }));
    expect(
      screen.getByText("August 2026 · 3.0 block hours · the month ends at midnight Alaska Time"),
    ).toBeInTheDocument();
    expect(screen.getByText("invoices sent this month")).toBeInTheDocument();
  });

  it("links to the month's accounting export, its dates filled in", async () => {
    render(await AccountingPage({ searchParams: Promise.resolve({ year: "2026", month: "8" }) }));
    expect(screen.getByRole("link", { name: "Export this month" }).getAttribute("href")).toBe(
      "/reservations/accounting-export?start=2026-08-01&end=2026-08-31",
    );
  });
});
