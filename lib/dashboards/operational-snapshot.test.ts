import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getFleetAirworthiness: vi.fn(),
  listMelItems: vi.fn(),
  getFlightBoard: vi.fn(),
  listSafetyReports: vi.fn(),
}));
vi.mock("@/lib/api/maintenance", () => ({
  getFleetAirworthiness: api.getFleetAirworthiness,
  listMelItems: api.listMelItems,
}));
vi.mock("@/lib/api/flight-following", () => ({ getFlightBoard: api.getFlightBoard }));
// The real client reaches next-auth, which does not load under vitest.
vi.mock("@/lib/api/client", () => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/api/safety-reports", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/safety-reports")>()),
  listSafetyReports: api.listSafetyReports,
}));

import { loadOperationalSnapshot } from "./operational-snapshot";

function report(id: string, risk_level: "high" | "medium" | null) {
  return {
    id,
    report_type: "near_miss",
    title: "Fuel truck inside the wing line",
    risk_level,
    status: "open",
    created_at: "2026-10-08T01:20:00Z",
  };
}

beforeEach(() => {
  api.getFleetAirworthiness.mockResolvedValue({ items: [] });
  api.listMelItems.mockResolvedValue({ items: [] });
  api.getFlightBoard.mockResolvedValue({ items: [] });
  api.listSafetyReports.mockReset();
});

describe("new safety report alerts (#58)", () => {
  it("raises one per report nobody has reviewed yet, red when rated high risk", async () => {
    api.listSafetyReports.mockResolvedValue({ items: [report("r-1", null), report("r-2", "high")], total: 2 });
    const { alerts } = await loadOperationalSnapshot();

    expect(api.listSafetyReports).toHaveBeenCalledWith({ status: "open", limit: 50 });
    expect(alerts.map((a) => [a.id, a.severity])).toEqual([
      ["safety-report-r-2", "red"],
      ["safety-report-r-1", "yellow"],
    ]);
    expect(alerts[1]).toMatchObject({
      category: "safety_report_new",
      title: "New safety report — Fuel truck inside the wing line",
      detail: "Near Miss · not reviewed yet",
      href: "/safety/reports/r-1",
      occurredAt: "2026-10-08T01:20:00Z",
    });
  });

  it("raises nothing for someone the service will not show reports to", async () => {
    api.listSafetyReports.mockRejectedValue(new Error("403"));
    const { alerts } = await loadOperationalSnapshot();
    expect(alerts).toEqual([]);
  });
});
