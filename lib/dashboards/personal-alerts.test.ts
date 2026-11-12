import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  listDayLoads,
  listSquawks,
  listWorkOrders,
  listMyHandoffs,
  listMyLoadTeams,
  listFuelOrders,
  getFlightBoard,
  loadZoneTable,
  listBookings,
} = vi.hoisted(() => ({
  listDayLoads: vi.fn(),
  listSquawks: vi.fn(),
  listWorkOrders: vi.fn(),
  listMyHandoffs: vi.fn(),
  listMyLoadTeams: vi.fn(),
  listFuelOrders: vi.fn(),
  getFlightBoard: vi.fn(),
  loadZoneTable: vi.fn(),
  listBookings: vi.fn(),
}));
vi.mock("@/lib/api/ground", () => ({ listDayLoads, listMyLoadTeams, listFuelOrders }));
vi.mock("@/lib/api/maintenance", () => ({ listSquawks, listWorkOrders }));
vi.mock("@/lib/api/ops", () => ({ listMyHandoffs }));
vi.mock("@/lib/api/flight-following", () => ({ getFlightBoard }));
vi.mock("@/lib/api/auth", () => ({ loadZoneTable }));
vi.mock("@/lib/api/reservations", () => ({ listBookings }));

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
  for (const f of [listDayLoads, listSquawks, listWorkOrders, listMyHandoffs, listMyLoadTeams, listFuelOrders, getFlightBoard, loadZoneTable, listBookings]) {
    f.mockReset();
  }
  listSquawks.mockResolvedValue({ items: [], total: 0 });
  listWorkOrders.mockResolvedValue({ items: [], total: 0 });
  listDayLoads.mockResolvedValue({ items: [], total: 0 });
  listMyHandoffs.mockResolvedValue({ items: [] });
  listMyLoadTeams.mockResolvedValue({ items: [], total: 0 });
  listFuelOrders.mockResolvedValue({ items: [], total: 0 });
  getFlightBoard.mockResolvedValue({ items: [] });
  loadZoneTable.mockResolvedValue({ byIcao: { PANC: "America/Anchorage", PABE: "America/Anchorage" }, fallback: "America/Anchorage" });
  listBookings.mockResolvedValue({ items: [], total: 0 });
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

  it("tells dispatch the pilot signed, without calling the flight ready: the packet has its own checks", async () => {
    listMyHandoffs.mockResolvedValue({
      items: [item({ kind: "release_ready", turn: "dispatch", by_name: "Grace Okafor" })],
    });
    const [alert] = await loadPersonalAlerts({ roles: ["dispatcher"], userId: "u-disp" });
    expect(alert.title).toBe("FRAT signed by both — MM118");
    expect(alert.detail).toMatch(/Grace Okafor signed it at .+; the release is next\.$/);
    expect(alert.href).toBe("/dispatch?flight=fl-118");
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

describe("the ramp's own, at its stations (LOG-42)", () => {
  const MIN = 60_000;
  const at = (offsetMin: number) => new Date(Date.now() + offsetMin * MIN).toISOString();
  const flight = (id: string, origin: string, offsetMin: number, over: Record<string, unknown> = {}) => ({
    id,
    flight_number: id.toUpperCase(),
    origin,
    destination: "PAKN",
    scheduled_departure_at: at(offsetMin),
    actual_departure_at: null,
    status: "released",
    aircraft: { id: `ac-${id}`, tail_number: "N603PA" },
    ...over,
  });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Anchorage" }).format(new Date());
  const order = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    n_number: "N603PA",
    base_code: "PABE",
    requested_fuel_date: today,
    requested_fuel_time: null,
    requested_quantity_gallons: 100,
    fuel_type_label_snapshot: "Jet A",
    supplier_name_snapshot: "Crowley",
    supplier: { id: "s-1", name: "Crowley", fueled_by: "own_staff" },
    status: "ordered",
    requested_at: at(-30),
    confirmed_at: null,
    ...over,
  });

  it("tells a Bethel ramper of Bethel's departures this hour that aren't loaded", async () => {
    listMyLoadTeams.mockResolvedValue({ items: [{ id: "lt-b", team_name: "Bethel Load Team", base_icao: "PABE" }], total: 1 });
    getFlightBoard.mockResolvedValue({
      items: [
        flight("fl1", "PABE", 40),
        flight("fl2", "PABE", 10),
        flight("fl3", "PANC", 20),
        flight("fl4", "PABE", 180),
        flight("fl5", "PABE", -5, { actual_departure_at: at(-4) }),
        flight("fl6", "PABE", 30),
        flight("fl8", "PABE", 45, { destination: "PABE", stops: ["PABE", "PAKN", "PABE"] }),
      ],
    });
    listDayLoads.mockResolvedValue({
      items: [
        load({ id: "as-6", flight: { id: "fl6", flight_number: "FL6", status: "released" } }),
        load({
          id: "as-1",
          flight: { id: "fl1", flight_number: "FL1", status: "released" },
          load_completed_at: null,
          load_started_at: at(-5),
          crew_user_ids: [],
        }),
      ],
      total: 2,
    });
    const alerts = await loadPersonalAlerts({ roles: ["ground_ops"], userId: "u-r" });
    const departing = alerts.filter((a) => a.category === "departure_soon");
    expect(departing.map((a) => [a.id, a.severity])).toEqual([
      ["departing-fl1", "yellow"],
      ["departing-fl2", "red"],
      ["departing-fl8", "yellow"],
    ]);
    // A round trip names its stops, not "PABE → PABE".
    expect(departing[2].detail).toMatch(/^N603PA, PABE → PAKN → PABE\. /);
    expect(departing[0].title).toMatch(/^Departing \d\d:\d\d AK[SD]T — FL1$/);
    expect(departing[0].detail).toMatch(/^N603PA, PABE → PAKN\. Anchorage Load Team A loading since \d\d:\d\d AK[SD]T\.$/);
    expect(departing[1].detail).toBe("N603PA, PABE → PAKN. No load team on it yet.");
    expect(departing.every((a) => a.href === "/ramper")).toBe(true);
  });

  it("tells them of today's fuel at their stations that the ramp puts in, not a supplier's", async () => {
    listMyLoadTeams.mockResolvedValue({ items: [{ id: "lt-b", team_name: "Bethel Load Team", base_icao: "PABE" }], total: 1 });
    listFuelOrders.mockImplementation(async ({ status }: { status: string }) => ({
      items:
        status === "ordered"
          ? [
              order("o1"),
              order("o2", { supplier: { id: "s-2", name: "Tundra", fueled_by: "supplier" } }),
              order("o3", { base_code: "PANC" }),
              order("o4", { requested_fuel_date: "2026-08-01" }),
            ]
          : [order("o5", { status: "confirmed", confirmed_at: at(-10) })],
      total: status === "ordered" ? 4 : 1,
    }));
    const fuel = (await loadPersonalAlerts({ roles: ["ground_ops"], userId: "u-r" })).filter((a) => a.category === "fuel_order");
    expect(fuel.map((a) => [a.id, a.title])).toEqual([
      ["fuel-o1", "Fuel to confirm — N603PA at PABE"],
      ["fuel-o5", "Fuel to put in — N603PA at PABE"],
    ]);
    expect(fuel[0].detail).toBe("100 gal Jet A, Crowley.");
    expect(fuel[1].occurredAt).toBe(order("o5", { confirmed_at: fuel[1].occurredAt }).confirmed_at);
  });

  it("on no team, every station is theirs; anyone else isn't told", async () => {
    getFlightBoard.mockResolvedValue({ items: [flight("fl3", "PANC", 20), flight("fl7", "PADU", 50)] });
    const ramper = await loadPersonalAlerts({ roles: ["ground_ops"], userId: "u-r" });
    expect(ramper.filter((a) => a.category === "departure_soon").map((a) => a.id)).toEqual(["departing-fl3", "departing-fl7"]);
    const pilot = await loadPersonalAlerts({ roles: ["pilot"], userId: "u-p" });
    expect(pilot.filter((a) => a.category === "departure_soon")).toEqual([]);
    expect(getFlightBoard).toHaveBeenCalledTimes(1);
  });
});

describe("a booking with no flight tells dispatch (LOG-05)", () => {
  it("names each one waiting, for dispatch only", async () => {
    listBookings.mockResolvedValue({
      items: [
        {
          id: "b-1",
          customer: { id: "c-1", full_name: "Ada Village" },
          origin_icao: "PAHP",
          destination_icao: "PABE",
          requested_departure_at: "2026-11-12T18:00:00Z",
          pax_count: 2,
          created_at: "2026-11-11T19:00:00Z",
        },
      ],
      total: 1,
    });
    const dispatch = (await loadPersonalAlerts({ roles: ["dispatcher"], userId: "u-d" })).filter((a) => a.category === "booking_waiting");
    expect(dispatch.map((a) => [a.id, a.title, a.href])).toEqual([
      ["booking-b-1", "Booking waiting for a flight — Ada Village", "/dispatch"],
    ]);
    expect(dispatch[0].detail).toMatch(/^2 pax PAHP → PABE, .+\. Place it from Dispatch\.$/);
    expect(dispatch[0].occurredAt).toBe("2026-11-11T19:00:00Z");
    expect(listBookings).toHaveBeenCalledWith(expect.objectContaining({ awaiting_flight: true, limit: 25 }));
    const ramp = (await loadPersonalAlerts({ roles: ["ground_ops"], userId: "u-r" })).filter((a) => a.category === "booking_waiting");
    expect(ramp).toEqual([]);
  });
});
