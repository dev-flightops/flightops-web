import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getFleetAirworthiness: vi.fn(),
  listMelItems: vi.fn(),
  getFlightBoard: vi.fn(),
  listSafetyReports: vi.fn(),
  listOpenSeats: vi.fn(),
  listFratAwaitingAcceptance: vi.fn(),
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
vi.mock("@/lib/api/open-seats", () => ({ listOpenSeats: api.listOpenSeats }));
vi.mock("@/lib/api/ops", () => ({ listFratAwaitingAcceptance: api.listFratAwaitingAcceptance }));

import type { Opening, OpeningPassenger } from "@/lib/api/open-seats";

import { loadOperationalSnapshot, waitingSummary } from "./operational-snapshot";

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
  api.listOpenSeats.mockReset().mockResolvedValue([]);
  // Everyone but the Chief Pilot and DO gets a 403 (#152).
  api.listFratAwaitingAcceptance.mockReset().mockRejectedValue(new Error("403"));
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

function waiting(name: string, over: Partial<OpeningPassenger> = {}): OpeningPassenger {
  return { id: name, name, boards_at: "PAHP", leaves_at: "PABE", phone: "(907) 555-0100", text: null, ...over };
}

function opening(over: Partial<Opening> = {}): Opening {
  return {
    flight_id: "f-900",
    flight_number: "PGR900",
    tail_number: "N503PA",
    scheduled_departure_at: "2026-10-26T18:00:00Z",
    stops: ["PABE", "PAVA", "PAHP", "PABE"],
    legs: [
      { origin: "PAVA", destination: "PAHP", open: 5 },
      { origin: "PAHP", destination: "PABE", open: 1 },
    ],
    no_shows: [waiting("Rider, C1", { boards_at: "PAVA" })],
    waiting: [],
    occurred_at: "2026-10-26T18:40:00Z",
    can_text: false,
    ...over,
  };
}

const text = (status: "sent" | "not_sent" | "failed") => ({
  id: "t",
  to_name: "x",
  to_phone: "x",
  body: "x",
  status,
  reason: status === "not_sent" ? "no_account" : null,
  sent_at: null,
  created_at: "2026-10-26T18:41:00Z",
});

describe("seat open alerts (#120)", () => {
  it("raises one per flight with a seat a no-show opened, for the gate page", async () => {
    api.listSafetyReports.mockResolvedValue({ items: [], total: 0 });
    api.listOpenSeats.mockResolvedValue([
      opening({ waiting: [waiting("Rider, Sam", { text: text("sent") }), waiting("Rider, Nell", { phone: null })] }),
    ]);
    const { alerts } = await loadOperationalSnapshot();
    expect(alerts).toEqual([
      {
        id: "seat-open-f-900",
        severity: "yellow",
        category: "seat_open",
        title: "Seat open — PGR900",
        detail: "PAVA → PAHP 5 open, PAHP → PABE 1 open · 2 waiting: 1 texted, 1 without a phone",
        href: "/check-in/f-900",
        scopedToIcao: "PAVA",
        occurredAt: "2026-10-26T18:40:00Z",
      },
    ]);
  });

  it("raises nothing for someone ops won't show openings to", async () => {
    api.listSafetyReports.mockResolvedValue({ items: [], total: 0 });
    api.listOpenSeats.mockRejectedValue(new Error("403"));
    expect((await loadOperationalSnapshot()).alerts).toEqual([]);
  });

  it("sums up who is waiting and how they were told", () => {
    expect(waitingSummary(opening())).toBe("no one waiting");
    expect(
      waitingSummary(
        opening({
          waiting: [
            waiting("a", { text: text("not_sent") }),
            waiting("b", { text: text("failed") }),
            waiting("c"),
          ],
        }),
      ),
    ).toBe("3 waiting: 2 texts not sent");
  });
});

describe("FRATs over company limits (#152)", () => {
  it("pings the Chief Pilot and DO: one red alert per FRAT waiting, to its packet", async () => {
    api.listSafetyReports.mockResolvedValue({ items: [], total: 0 });
    api.listFratAwaitingAcceptance.mockResolvedValue({
      items: [
        {
          flight_id: "f-1122",
          flight_number: "MM1122",
          scheduled_departure_at: "2026-10-30T17:33:00Z",
          assessment_id: "a-1",
          pilot_name: "Bob Henderson",
          over_limit_factors: ["wx_wind"],
          mitigations: "Planning to use runway 12.",
          filed_at: "2026-10-30T16:00:00Z",
          accepted: null,
        },
      ],
    });
    const [alert] = (await loadOperationalSnapshot()).alerts;
    expect(alert).toMatchObject({
      id: "frat-over-limits-a-1",
      severity: "red",
      category: "frat_over_limits",
      title: "FRAT over company limits — MM1122",
      href: "/dispatch?flight=f-1122",
      occurredAt: "2026-10-30T16:00:00Z",
    });
    expect(alert.detail).toMatch(/^Bob Henderson · .+ · waiting for the Chief Pilot or DO$/);
  });

  it("raises nothing for anyone else", async () => {
    api.listSafetyReports.mockResolvedValue({ items: [], total: 0 });
    expect((await loadOperationalSnapshot()).alerts).toEqual([]);
  });
});
