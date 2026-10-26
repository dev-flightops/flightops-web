import { afterEach, describe, expect, it } from "vitest";

import type { CheckInPax, CheckInView } from "@/lib/api/check-in";

import { applyStep, checkInNeedsForm, loadQueue, saveQueue, type QueuedStep } from "./offline";

/** Taps kept on a phone without signal (#119): shown at once, as the
 *  server will hold them, and kept per flight across a reload. */

function pax(id: string, over: Partial<CheckInPax> = {}): CheckInPax {
  return {
    id,
    first_name: id,
    last_name: "Test",
    seat_number: null,
    ticket_type: "revenue",
    is_unaccompanied_minor: false,
    contact_phone: null,
    notes: null,
    weight_lbs: "180.0",
    baggage_lbs: "20.0",
    planned_weight_lbs: null,
    planned_baggage_lbs: null,
    bags_count: null,
    check_in_status: "booked",
    standby: false,
    id_verified: false,
    hazmat_declared: false,
    hazmat_notes: null,
    custom_fields: {},
    checked_in_at: null,
    checked_in_by_name: null,
    boarded_at: null,
    no_show_reason: null,
    no_show_notes: null,
    no_show_at: null,
    no_show_fee: null,
    ...over,
  };
}

function view(passengers: CheckInPax[]): CheckInView {
  return {
    flight_id: "f-1",
    flight_number: "PGR801",
    origin: "PAVA",
    destination: "PABE",
    scheduled_departure_at: "2026-10-26T18:30:00Z",
    flight_status: "released",
    tail_number: "N806PA",
    manifest_id: "m-1",
    manifest_status: "draft",
    locked_at: null,
    boarding_opened_at: null,
    boarding_closed_at: null,
    rules: {
      require_actual_weight: false,
      require_actual_bag_weight: false,
      require_bags_count: false,
      require_id_verification: false,
      require_hazmat_declaration: false,
      require_seat_assignment: false,
      no_show_fee: null,
      standby_enabled: true,
      allow_walk_up: true,
      lock_manifest_on_close: true,
    },
    fields: [],
    no_show_reasons: [],
    passengers,
    counts: { booked: 0, checked_in: 0, boarded: 0, no_show: 0, standby: 0, total: 0 },
    weights: { planned_pax_lbs: "0", planned_bags_lbs: "0", actual_pax_lbs: "0", actual_bags_lbs: "0" },
  };
}

const AT = "2026-10-26T18:05:00.000Z";

afterEach(() => window.localStorage.clear());

describe("a step kept without signal, shown at once", () => {
  it("checks in with the weights given, then boards", () => {
    const steps: QueuedStep[] = [
      { kind: "check-in", paxId: "ana", input: { actual_weight_lbs: 175, bags_count: 2, id_verified: true, hazmat_declared: false }, at: AT },
      { kind: "open-boarding", at: AT },
      { kind: "board", paxId: "ana", at: AT },
    ];
    const after = steps.reduce(applyStep, view([pax("ana"), pax("ben")]));
    const ana = after.passengers[0];
    expect([ana.check_in_status, ana.weight_lbs, ana.planned_weight_lbs, ana.bags_count]).toEqual([
      "boarded", "175", "180.0", 2,
    ]);
    expect([ana.checked_in_at, ana.boarded_at, after.boarding_opened_at]).toEqual([AT, AT, AT]);
    expect(after.counts).toEqual({ booked: 1, checked_in: 0, boarded: 1, no_show: 0, standby: 0, total: 2 });
  });

  it("seats a standby passenger, marks a no-show, and undoes it", () => {
    const start = view([pax("sam", { ticket_type: "standby", standby: true }), pax("ana")]);
    let v = applyStep(start, { kind: "promote", paxId: "sam", at: AT });
    v = applyStep(v, { kind: "no-show", paxId: "ana", reason: "did_not_appear", notes: null, at: AT });
    expect(v.counts).toEqual({ booked: 0, checked_in: 1, boarded: 0, no_show: 1, standby: 0, total: 2 });
    v = applyStep(v, { kind: "reset", paxId: "ana", at: AT });
    expect(v.passengers[1].check_in_status).toBe("booked");
    expect(v.counts.booked).toBe(1);
  });

  it("doesn't board anyone not checked in, as the server wouldn't", () => {
    const v = applyStep(view([pax("ana")]), { kind: "board", paxId: "ana", at: AT });
    expect(v.passengers[0].check_in_status).toBe("booked");
  });
});

describe("kept per flight", () => {
  it("survives a reload, and an empty queue leaves nothing behind", () => {
    const step: QueuedStep = { kind: "board", paxId: "ana", at: AT };
    expect(saveQueue("f-1", [step])).toBe(true);
    expect(loadQueue("f-1")).toEqual([step]);
    expect(loadQueue("f-2")).toEqual([]);
    saveQueue("f-1", []);
    expect(window.localStorage.getItem("fo-check-in-queue:f-1")).toBeNull();
  });

  it("reads nothing from what isn't a queue", () => {
    window.localStorage.setItem("fo-check-in-queue:f-1", "{not json");
    expect(loadQueue("f-1")).toEqual([]);
  });
});

describe("one tap or the form", () => {
  it("is one tap when the company requires nothing a tap can't give", () => {
    const v = view([pax("ana")]);
    expect(checkInNeedsForm(v, v.passengers[0])).toBe(false);
    expect(checkInNeedsForm({ ...v, rules: { ...v.rules, require_bags_count: true } }, v.passengers[0])).toBe(true);
    const seat = { ...v, rules: { ...v.rules, require_seat_assignment: true } };
    expect(checkInNeedsForm(seat, v.passengers[0])).toBe(true);
    expect(checkInNeedsForm(seat, pax("ana", { seat_number: "3A" }))).toBe(false);
  });
});
