import { beforeEach, describe, expect, it, vi } from "vitest";

const { listDayLoads, listSquawks, listWorkOrders, listMyHandoffs } = vi.hoisted(() => ({
  listDayLoads: vi.fn(),
  listSquawks: vi.fn(),
  listWorkOrders: vi.fn(),
  listMyHandoffs: vi.fn(),
}));
vi.mock("@/lib/api/ground", () => ({ listDayLoads }));
vi.mock("@/lib/api/maintenance", () => ({ listSquawks, listWorkOrders }));
vi.mock("@/lib/api/ops", () => ({ listMyHandoffs }));

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
  for (const f of [listDayLoads, listSquawks, listWorkOrders, listMyHandoffs]) f.mockReset();
  listSquawks.mockResolvedValue({ items: [], total: 0 });
  listWorkOrders.mockResolvedValue({ items: [], total: 0 });
  listDayLoads.mockResolvedValue({ items: [], total: 0 });
  listMyHandoffs.mockResolvedValue({ items: [] });
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

describe("the hand-offs between dispatch and the pilot (#175)", () => {
  const item = (over: Record<string, unknown> = {}) => ({
    kind: "frat_to_sign",
    turn: "pilot",
    flight_id: "fl-118",
    flight_number: "MM118",
    origin: "PABE",
    destination: "PABE",
    stops: ["PABE", "PACK", "PABE"],
    scheduled_departure_at: now,
    occurred_at: "2026-11-08T21:15:00Z",
    by_name: "Peregrine Admin",
    filed_by_pilot: false,
    refiled: false,
    note: null,
    ...over,
  });

  it("tells the pilot the FRAT dispatch signed is theirs to sign, at preflight step 1", async () => {
    listMyHandoffs.mockResolvedValue({ items: [item()] });
    const [alert] = await loadPersonalAlerts({ roles: ["pilot"], userId: "u-pilot" });
    expect(alert).toMatchObject({
      id: "handoff-frat_to_sign-pilot-fl-118",
      category: "handoff",
      severity: "yellow",
      title: "Sign the FRAT — MM118",
      href: "/flight-crew/preflight/fl-118",
      occurredAt: "2026-11-08T21:15:00Z",
    });
    expect(alert.detail).toMatch(/^PABE → PACK → PABE\. Peregrine Admin scored and signed it at .+\. Review it and sign it at preflight step 1\.$/);
  });

  it("tells dispatch the pilot changed the FRAT, to sign it again", async () => {
    listMyHandoffs.mockResolvedValue({
      items: [item({ turn: "dispatch", by_name: "Grace Okafor", filed_by_pilot: true, refiled: true })],
    });
    const [alert] = await loadPersonalAlerts({ roles: ["dispatcher"], userId: "u-disp" });
    expect(alert.title).toBe("FRAT changed by the pilot — MM118");
    expect(alert.detail).toMatch(/Grace Okafor changed it at .+\. Review it and sign again; then the pilot signs\.$/);
    expect(alert.href).toBe("/frat/fl-118");
  });

  it("puts a denied release and a load returned in red, to the packet", async () => {
    listMyHandoffs.mockResolvedValue({
      items: [
        item({ kind: "release_denied", turn: "dispatch", by_name: "Grace Okafor", note: "Icing over the Kilbucks." }),
        item({ kind: "weight_returned", turn: "dispatch", by_name: "Grace Okafor", note: "1100" }),
      ],
    });
    const alerts = await loadPersonalAlerts({ roles: ["dispatcher"], userId: "u-disp" });
    expect(alerts.map((a) => [a.title, a.severity, a.href])).toEqual([
      ["Release denied — MM118", "red", "/dispatch?flight=fl-118"],
      ["Returned over weight — MM118", "red", "/dispatch?flight=fl-118"],
    ]);
    expect(alerts[0].detail).toMatch(/Icing over the Kilbucks\.$/);
    expect(alerts[1].detail).toMatch(/^Grace Okafor can take 1,100 lb/);
  });

  it("goes without them when ops can't be reached", async () => {
    listMyHandoffs.mockRejectedValue(new Error("down"));
    expect(await loadPersonalAlerts({ roles: ["pilot"], userId: "u-pilot" })).toEqual([]);
  });
});
