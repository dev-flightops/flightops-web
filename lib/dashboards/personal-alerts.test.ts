import { beforeEach, describe, expect, it, vi } from "vitest";

const { listDayLoads, listSquawks, listWorkOrders } = vi.hoisted(() => ({
  listDayLoads: vi.fn(),
  listSquawks: vi.fn(),
  listWorkOrders: vi.fn(),
}));
vi.mock("@/lib/api/ground", () => ({ listDayLoads }));
vi.mock("@/lib/api/maintenance", () => ({ listSquawks, listWorkOrders }));

import { loadPersonalAlerts } from "./personal-alerts";

const now = new Date().toISOString();
const squawk = (id: string, severity = "major", reported_at = now) => ({
  id,
  title: "Left nav light inoperative",
  severity,
  status: "open",
  reported_at,
  aircraft: { id: "ac-94", tail_number: "N94DM", model: "Cessna 208 Caravan" },
  reported_by: { id: "u-p", full_name: "Prepared Demo Pilot", email: "p@x" },
});
const load = (over: Record<string, unknown> = {}) => ({
  id: "as-1",
  flight: { id: "fl-104", flight_number: "DEMO104", status: "released" },
  load_team: { team_name: "Anchorage Load Team A" },
  load_completed_at: now,
  load_completed_by: { full_name: "Nina Brightwater" },
  photo_count: 1,
  crew_user_ids: ["u-pilot"],
  ...over,
});

beforeEach(() => {
  for (const f of [listDayLoads, listSquawks, listWorkOrders]) f.mockReset();
  listSquawks.mockResolvedValue({ items: [], total: 0 });
  listWorkOrders.mockResolvedValue({ items: [], total: 0 });
  listDayLoads.mockResolvedValue({ items: [], total: 0 });
});

describe("the bell, per person (#134)", () => {
  it("tells maintenance of a new squawk until a work order is opened for it", async () => {
    listSquawks.mockResolvedValue({
      items: [squawk("s-new"), squawk("s-worked"), squawk("s-old", "major", "2026-01-01T00:00:00Z"), squawk("s-ground", "grounding")],
      total: 4,
    });
    listWorkOrders.mockResolvedValue({ items: [{ squawk_id: "s-worked" }], total: 1 });
    const alerts = await loadPersonalAlerts({ roles: ["maintenance"], userId: "u-mx" });
    expect(alerts.map((a) => [a.id, a.severity])).toEqual([
      ["squawk-s-new", "yellow"],
      ["squawk-s-ground", "red"],
    ]);
    expect(alerts[0].href).toBe("/maintenance/work-orders/new?squawk=s-new");
  });

  it("doesn't tell a ramper about squawks", async () => {
    listSquawks.mockResolvedValue({ items: [squawk("s-new")], total: 1 });
    expect(await loadPersonalAlerts({ roles: ["ground_ops"], userId: "u-r" })).toEqual([]);
    expect(listSquawks).not.toHaveBeenCalled();
  });

  it("tells the flight's pilot and dispatch the load is complete, until it departs", async () => {
    listDayLoads.mockResolvedValue({
      items: [load(), load({ id: "as-2", flight: { id: "fl-1", flight_number: "DEMO101", status: "completed" } }), load({ id: "as-3", load_completed_at: null })],
      total: 3,
    });
    const pilot = await loadPersonalAlerts({ roles: ["pilot"], userId: "u-pilot" });
    expect(pilot.map((a) => a.id)).toEqual(["load-as-1"]);
    expect(pilot[0].href).toBe("/flight-crew/preflight/fl-104");
    expect(pilot[0].detail).toMatch(/^Anchorage Load Team A, Nina Brightwater at .+ · 1 photo\.$/);
    const dispatch = await loadPersonalAlerts({ roles: ["dispatcher"], userId: "u-d" });
    expect(dispatch.map((a) => a.href)).toEqual(["/dispatch?flight=fl-104"]);
    expect(await loadPersonalAlerts({ roles: ["pilot"], userId: "u-other" })).toEqual([]);
  });
});
