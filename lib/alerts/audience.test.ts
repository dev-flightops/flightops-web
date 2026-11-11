import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OperationalAlert } from "@/lib/dashboards/operational-snapshot";

import { alertIsFor } from "./audience";

const { loadOperationalSnapshot, loadPersonalAlerts, listAlertAcknowledgments } = vi.hoisted(() => ({
  loadOperationalSnapshot: vi.fn(),
  loadPersonalAlerts: vi.fn(),
  listAlertAcknowledgments: vi.fn(),
}));
vi.mock("@/lib/dashboards/operational-snapshot", () => ({ loadOperationalSnapshot }));
vi.mock("@/lib/dashboards/personal-alerts", () => ({ loadPersonalAlerts }));
vi.mock("@/lib/api/ops", () => ({ listAlertAcknowledgments }));

import { loadUnacknowledgedAlerts } from "@/lib/dashboards/unacknowledged-alerts";

const alert = (category: OperationalAlert["category"], severity: "red" | "yellow" = "red"): OperationalAlert => ({
  id: `${category}-1`,
  severity,
  category,
  title: category,
  detail: "",
  href: "/",
  occurredAt: "2026-11-11T10:00:00Z",
});

describe("each alert goes to the roles that act on it (LOG-42)", () => {
  it("gives dispatch and the operation's leaders everything", () => {
    for (const role of ["dispatcher", "chief_pilot", "director_of_operations", "exec_admin"]) {
      for (const c of ["aircraft_grounded", "flight_overdue", "duty_over_limit", "mel_expiring", "seat_open"] as const) {
        expect(alertIsFor(alert(c), [role])).toBe(true);
      }
    }
  });

  it("gives maintenance the groundings and MELs, not overdue flights", () => {
    for (const role of ["maintenance", "director_of_maintenance"]) {
      expect(alertIsFor(alert("aircraft_grounded"), [role])).toBe(true);
      expect(alertIsFor(alert("mel_expiring"), [role])).toBe(true);
      expect(alertIsFor(alert("flight_overdue"), [role])).toBe(false);
      expect(alertIsFor(alert("duty_over_limit"), [role])).toBe(false);
    }
  });

  it("gives the ramp its own and the seats a no-show opened, not groundings or overdue flights", () => {
    const ramp = ["ground_ops"];
    expect(alertIsFor(alert("aircraft_grounded"), ramp)).toBe(false);
    expect(alertIsFor(alert("flight_overdue"), ramp)).toBe(false);
    expect(alertIsFor(alert("mel_expiring"), ramp)).toBe(false);
    expect(alertIsFor(alert("seat_open"), ramp)).toBe(true);
    expect(alertIsFor(alert("departure_soon"), ramp)).toBe(true);
    expect(alertIsFor(alert("fuel_order"), ramp)).toBe(true);
  });

  it("gives the Safety Officer the new safety reports, and a pilot only their own", () => {
    expect(alertIsFor(alert("safety_report_new"), ["safety_officer"])).toBe(true);
    expect(alertIsFor(alert("flight_overdue"), ["safety_officer"])).toBe(false);
    expect(alertIsFor(alert("aircraft_grounded"), ["pilot"])).toBe(false);
    expect(alertIsFor(alert("handoff"), ["pilot"])).toBe(true);
    expect(alertIsFor(alert("load_complete"), ["pilot"])).toBe(true);
  });

  it("holds any of the roles: a ramper who is also maintenance sees groundings", () => {
    expect(alertIsFor(alert("aircraft_grounded"), ["ground_ops", "maintenance"])).toBe(true);
  });

  it("shows everything to a session that came without its roles", () => {
    expect(alertIsFor(alert("flight_overdue"), [])).toBe(true);
  });
});

describe("the bell filters the operation's alerts by role", () => {
  beforeEach(() => {
    loadOperationalSnapshot.mockResolvedValue({
      alerts: [alert("aircraft_grounded"), alert("flight_overdue"), alert("seat_open", "yellow")],
    });
    loadPersonalAlerts.mockResolvedValue([alert("departure_soon", "yellow")]);
    listAlertAcknowledgments.mockResolvedValue([]);
  });

  it("gives a ramper the seat and their own, a dispatcher all of it", async () => {
    const ramp = await loadUnacknowledgedAlerts({ roles: ["ground_ops"], userId: "u-r" });
    expect(ramp.alerts.map((a) => a.category)).toEqual(["seat_open", "departure_soon"]);
    const dispatch = await loadUnacknowledgedAlerts({ roles: ["dispatcher"], userId: "u-d" });
    expect(dispatch.alerts.map((a) => a.category)).toEqual([
      "aircraft_grounded",
      "flight_overdue",
      "seat_open",
      "departure_soon",
    ]);
  });
});
