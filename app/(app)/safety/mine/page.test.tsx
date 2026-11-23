import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SafetyReport } from "@/lib/api/safety-reports";

const { listMySafetyReports, listMyHazards } = vi.hoisted(() => ({
  listMySafetyReports: vi.fn(),
  listMyHazards: vi.fn(async () => ({ items: [] })),
}));
vi.mock("@/lib/api/safety-reports", async (actual) => ({
  ...(await actual<typeof import("@/lib/api/safety-reports")>()),
  listMySafetyReports,
}));
vi.mock("@/lib/api/safety", async (actual) => ({
  ...(await actual<typeof import("@/lib/api/safety")>()),
  listMyHazards,
}));
vi.mock("@/lib/api/auth", () => ({ loadZoneTable: vi.fn(async () => ({ fallback: "America/Anchorage" })) }));
vi.mock("@/auth", () => ({ auth: vi.fn(async () => null) }));

import MySafetyReportsPage from "./page";

function report(over: Partial<SafetyReport> = {}): SafetyReport {
  return {
    id: "r-1",
    report_type: "near_miss",
    title: "Four-wheeler on the runway",
    description: "",
    location: null,
    flight_number: null,
    aircraft_tail: null,
    occurred_on: "2026-11-19",
    is_anonymous: false,
    reporter: null,
    reporter_department: null,
    severity: null,
    likelihood: null,
    risk_score: null,
    risk_level: null,
    status: "open",
    assigned_to: null,
    resolution: null,
    reviewed_at: null,
    reviewed_by: null,
    closed_at: null,
    closed_by: null,
    attachment: null,
    created_at: "2026-11-20T05:11:00Z",
    updated_at: "2026-11-20T05:11:00Z",
    ...over,
  };
}

describe("My Reports", () => {
  it("dates a report filed at 20:11 AKST on the Alaska day, not the UTC one (1119-22)", async () => {
    listMySafetyReports.mockResolvedValueOnce({ items: [report()] });
    render(await MySafetyReportsPage());
    expect(screen.getByText("Filed Nov 19, 2026")).toBeInTheDocument();
    expect(screen.queryByText(/Nov 20/)).not.toBeInTheDocument();
  });
});
