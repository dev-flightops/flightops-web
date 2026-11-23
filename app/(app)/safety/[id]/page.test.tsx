import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { HazardReport } from "@/lib/api/safety";

const { getHazard } = vi.hoisted(() => ({ getHazard: vi.fn() }));
vi.mock("@/lib/api/safety", async (actual) => ({
  ...(await actual<typeof import("@/lib/api/safety")>()),
  getHazard,
}));
vi.mock("@/lib/api/auth", () => ({ loadZoneTable: vi.fn(async () => ({ byIcao: {}, fallback: "America/Anchorage" })) }));
vi.mock("@/auth", () => ({ auth: vi.fn(async () => null) }));

import SafetyHazardDetailPage from "./page";

function hazard(over: Partial<HazardReport> = {}): HazardReport {
  return {
    id: "h-1",
    category: "ground_ops",
    severity: "medium",
    status: "triaged",
    description: "Ice on the ramp by the fuel truck.",
    immediate_action_taken: null,
    location_free_text: null,
    station: null,
    is_anonymous: false,
    reporter: null,
    triaged_at: "2026-11-20T06:00:00Z",
    triaged_by: null,
    closed_at: null,
    closed_by: null,
    closed_reason: null,
    created_at: "2026-11-20T05:11:00Z",
    updated_at: "2026-11-20T06:00:00Z",
    ...over,
  } as HazardReport;
}

describe("Hazard detail", () => {
  it("gives a hazard filed at 20:11 AKST in Alaska time, not the server's UTC (1119-22)", async () => {
    getHazard.mockResolvedValueOnce(hazard());
    render(await SafetyHazardDetailPage({ params: Promise.resolve({ id: "h-1" }), searchParams: Promise.resolve({}) }));
    expect(screen.getByText(/Filed Nov 19, 2026, 20:11 AKST/)).toBeInTheDocument();
    expect(screen.getByText(/Nov 19, 2026, 21:00 AKST/)).toBeInTheDocument();
    expect(screen.queryByText(/Nov 20/)).not.toBeInTheDocument();
  });
});
