import { describe, expect, it } from "vitest";

import {
  costByEmployee,
  costCsv,
  historyCsv,
  occupancyCsv,
  toCsv,
  dayCount,
  employeeHistory,
  nightsInWindow,
  occupancyByUnit,
  roomCost,
  totalNights,
  type ReportBooking,
  type ReportRoom,
  type ReportUnit,
} from "./reports";

/**
 * Housing report arithmetic.
 *
 * The thing worth pinning hardest is the half-open date bound. A stay
 * from the 3rd to the 5th is two nights, and counting it as three
 * overstates every occupancy figure and every cost by one night per
 * booking — an error that looks plausible on screen and is wrong on an
 * invoice.
 */

const unit = (over: Partial<ReportUnit> & { id: string }): ReportUnit => ({
  name: "Bethel Crew House",
  station: "PABE",
  ...over,
});

const room = (over: Partial<ReportRoom> & { id: string }): ReportRoom => ({
  unit_id: "u1",
  room_number: "01",
  capacity: 1,
  cost_per_night: "100.00",
  ...over,
});

const booking = (
  over: Partial<ReportBooking> & { id: string },
): ReportBooking => ({
  room_id: "r1",
  room_number: "01",
  unit_id: "u1",
  unit_name: "Bethel Crew House",
  employee_user_id: "e1",
  employee_name: "Alice Chen",
  check_in: "2026-09-03",
  check_out: "2026-09-05",
  purpose: "crew_rest",
  is_cancelled: false,
  ...over,
});

describe("nights are half-open", () => {
  it("counts a 3rd-to-5th stay as two nights", () => {
    expect(totalNights({ check_in: "2026-09-03", check_out: "2026-09-05" })).toBe(2);
  });

  it("counts a same-day check-in and check-out as no nights", () => {
    expect(totalNights({ check_in: "2026-09-03", check_out: "2026-09-03" })).toBe(0);
  });

  it("has no total for an open-ended stay", () => {
    // Still resident. Zero would read as "stayed no nights".
    expect(totalNights({ check_in: "2026-09-03", check_out: null })).toBeNull();
  });
});

describe("dayCount", () => {
  it("counts a single-day window as one night", () => {
    expect(dayCount("2026-09-03", "2026-09-03")).toBe(1);
  });

  it("counts September", () => {
    expect(dayCount("2026-09-01", "2026-09-30")).toBe(30);
  });

  it("does not go negative on a backwards range", () => {
    expect(dayCount("2026-09-30", "2026-09-01")).toBe(0);
  });

  it("spans a month boundary", () => {
    expect(dayCount("2026-09-28", "2026-10-02")).toBe(5);
  });
});

describe("nightsInWindow", () => {
  it("counts a stay fully inside the window", () => {
    expect(nightsInWindow({ check_in: "2026-09-03", check_out: "2026-09-05" }, "2026-09-01", "2026-09-30")).toBe(2);
  });

  it("clips a stay that starts before the window", () => {
    expect(nightsInWindow({ check_in: "2026-08-28", check_out: "2026-09-03" }, "2026-09-01", "2026-09-30")).toBe(2);
  });

  it("clips a stay that runs past the window", () => {
    // 28, 29, 30 — three nights; the window's last night is the 30th.
    expect(nightsInWindow({ check_in: "2026-09-28", check_out: "2026-10-10" }, "2026-09-01", "2026-09-30")).toBe(3);
  });

  it("clamps an open-ended stay to the end of the window", () => {
    expect(nightsInWindow({ check_in: "2026-09-29", check_out: null }, "2026-09-01", "2026-09-30")).toBe(2);
  });

  it("ignores a stay that ended before the window opened", () => {
    expect(nightsInWindow({ check_in: "2026-08-01", check_out: "2026-08-20" }, "2026-09-01", "2026-09-30")).toBe(0);
  });

  it("ignores a stay that begins after the window closed", () => {
    expect(nightsInWindow({ check_in: "2026-10-05", check_out: "2026-10-09" }, "2026-09-01", "2026-09-30")).toBe(0);
  });

  it("counts a checkout on the window's first day as no nights in it", () => {
    // Guest left on the 1st, so slept the night of Aug 31, not Sep 1.
    expect(nightsInWindow({ check_in: "2026-08-30", check_out: "2026-09-01" }, "2026-09-01", "2026-09-30")).toBe(0);
  });

  it("is unaffected by the host timezone", () => {
    // Dates are parsed as UTC. Local parsing would shift the day for
    // anyone west of UTC and move a booking across a boundary.
    const tz = process.env.TZ;
    try {
      process.env.TZ = "Pacific/Honolulu";
      expect(nightsInWindow({ check_in: "2026-09-03", check_out: "2026-09-05" }, "2026-09-01", "2026-09-30")).toBe(2);
    } finally {
      process.env.TZ = tz;
    }
  });
});

describe("occupancyByUnit", () => {
  const units = [unit({ id: "u1" }), unit({ id: "u2", name: "Dorm B", station: "PADU" })];
  const rooms = [
    room({ id: "r1", unit_id: "u1" }),
    room({ id: "r2", unit_id: "u1", room_number: "02" }),
    room({ id: "r3", unit_id: "u2" }),
  ];

  it("divides occupied nights by rooms x nights", () => {
    // u1: 2 rooms x 10 nights = 20 room-nights; one 2-night stay.
    const rows = occupancyByUnit(units, rooms, [booking({ id: "b1" })], "2026-09-01", "2026-09-10");
    const u1 = rows.find((r) => r.unitId === "u1")!;
    expect(u1.roomNights).toBe(20);
    expect(u1.occupiedNights).toBe(2);
    expect(u1.occupancyPct).toBeCloseTo(10);
  });

  it("reports a unit with no bookings as zero, not missing", () => {
    const rows = occupancyByUnit(units, rooms, [], "2026-09-01", "2026-09-10");
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.occupiedNights === 0)).toBe(true);
  });

  it("declines to score a unit with no rooms rather than calling it 0%", () => {
    // A house with no rooms entered is not a house running empty —
    // it is a house nobody has finished setting up.
    const rows = occupancyByUnit([unit({ id: "u3", name: "New House" })], [], [], "2026-09-01", "2026-09-10");
    expect(rows[0].roomNights).toBe(0);
    expect(rows[0].occupancyPct).toBeNull();
  });

  it("excludes cancelled bookings", () => {
    const rows = occupancyByUnit(units, rooms, [booking({ id: "b1", is_cancelled: true })], "2026-09-01", "2026-09-10");
    expect(rows.find((r) => r.unitId === "u1")!.occupiedNights).toBe(0);
  });

  it("attributes a booking by its room when unit_id is absent", () => {
    const rows = occupancyByUnit(units, rooms, [booking({ id: "b1", unit_id: null, room_id: "r3" })], "2026-09-01", "2026-09-10");
    expect(rows.find((r) => r.unitId === "u2")!.occupiedNights).toBe(2);
  });

  it("sorts by station then name", () => {
    const rows = occupancyByUnit(units, rooms, [], "2026-09-01", "2026-09-10");
    expect(rows.map((r) => r.station)).toEqual(["PABE", "PADU"]);
  });
});

describe("employeeHistory", () => {
  it("prices a finished stay at nights x room rate", () => {
    const rows = employeeHistory([booking({ id: "b1" })], [room({ id: "r1" })]);
    expect(rows[0].nights).toBe(2);
    expect(rows[0].cost).toBe(200);
  });

  it("leaves cost unknown when the room has no rate", () => {
    // Not zero. A room nobody priced is not a free room.
    const rows = employeeHistory([booking({ id: "b1" })], [room({ id: "r1", cost_per_night: null })]);
    expect(rows[0].cost).toBeNull();
  });

  it("leaves cost unknown while the stay is still open", () => {
    const rows = employeeHistory([booking({ id: "b1", check_out: null })], [room({ id: "r1" })]);
    expect(rows[0].nights).toBeNull();
    expect(rows[0].cost).toBeNull();
  });

  it("names an employee it cannot identify rather than rendering a blank", () => {
    const rows = employeeHistory([booking({ id: "b1", employee_name: null })], [room({ id: "r1" })]);
    expect(rows[0].employee).toBe("(unknown employee)");
  });

  it("keeps cancelled bookings but marks them", () => {
    // History is a record of what happened, and a cancelled booking
    // is part of it.
    const rows = employeeHistory([booking({ id: "b1", is_cancelled: true })], [room({ id: "r1" })]);
    expect(rows).toHaveLength(1);
    expect(rows[0].isCancelled).toBe(true);
  });
});

describe("costByEmployee", () => {
  it("sums a person's nights and cost across bookings", () => {
    const rows = costByEmployee(
      [
        booking({ id: "b1", check_in: "2026-09-03", check_out: "2026-09-05" }),
        booking({ id: "b2", check_in: "2026-09-10", check_out: "2026-09-13" }),
      ],
      [room({ id: "r1" })],
      "2026-09-01",
      "2026-09-30",
    );
    expect(rows.rows[0].nights).toBe(5);
    expect(rows.rows[0].cost).toBe(500);
    expect(rows.total).toBe(500);
  });

  it("counts unpriced bookings instead of treating them as free", () => {
    const rep = costByEmployee(
      [booking({ id: "b1" })],
      [room({ id: "r1", cost_per_night: null })],
      "2026-09-01",
      "2026-09-30",
    );
    expect(rep.rows[0].nights).toBe(2);
    expect(rep.rows[0].cost).toBe(0);
    expect(rep.rows[0].unpricedBookings).toBe(1);
    expect(rep.unpricedBookings).toBe(1);
  });

  it("only counts the nights that fall inside the window", () => {
    const rep = costByEmployee(
      [booking({ id: "b1", check_in: "2026-08-28", check_out: "2026-09-03" })],
      [room({ id: "r1" })],
      "2026-09-01",
      "2026-09-30",
    );
    expect(rep.rows[0].nights).toBe(2);
    expect(rep.total).toBe(200);
  });

  it("excludes cancelled bookings from cost", () => {
    const rep = costByEmployee([booking({ id: "b1", is_cancelled: true })], [room({ id: "r1" })], "2026-09-01", "2026-09-30");
    expect(rep.rows).toEqual([]);
    expect(rep.total).toBe(0);
  });

  it("ranks the most expensive occupant first", () => {
    const rep = costByEmployee(
      [
        booking({ id: "b1", employee_name: "Alice Chen", check_in: "2026-09-01", check_out: "2026-09-03" }),
        booking({ id: "b2", employee_name: "Bob Henderson", check_in: "2026-09-01", check_out: "2026-09-08", room_id: "r2" }),
      ],
      [room({ id: "r1" }), room({ id: "r2", cost_per_night: "50.00" })],
      "2026-09-01",
      "2026-09-30",
    );
    expect(rep.rows.map((r) => r.employee)).toEqual(["Bob Henderson", "Alice Chen"]);
    expect(rep.total).toBe(550);
  });
});

describe("roomCost", () => {
  it("parses the string Pydantic sends for a Decimal", () => {
    expect(roomCost(room({ id: "r1", cost_per_night: "85.50" }))).toBe(85.5);
  });

  it("accepts a number", () => {
    expect(roomCost(room({ id: "r1", cost_per_night: 85.5 }))).toBe(85.5);
  });

  it("is unknown for a missing room rather than free", () => {
    expect(roomCost(undefined)).toBeNull();
  });

  it("is unknown for unparseable input", () => {
    expect(roomCost(room({ id: "r1", cost_per_night: "n/a" }))).toBeNull();
  });
});

describe("CSV", () => {
  it("quotes a value containing a comma", () => {
    expect(toCsv(["a"], [["Bethel, AK"]])).toContain('"Bethel, AK"');
  });

  it("doubles an embedded quote", () => {
    expect(toCsv(["a"], [['He said "hi"']])).toContain('"He said ""hi"""');
  });

  it("leaves an unknown value empty rather than writing a dash", () => {
    // The page renders an em-dash for "not computable". Exporting that
    // glyph would put text in a numeric column — this is why the CSV
    // is built from the data and not scraped from the table.
    const csv = historyCsv([
      {
        bookingId: "b1",
        employee: "Alice Chen",
        unitName: "Bethel Crew House",
        roomNumber: "01",
        checkIn: "2026-09-03",
        checkOut: null,
        nights: null,
        cost: null,
        purpose: null,
        isCancelled: false,
      },
    ]);
    const dataLine = csv.split("\r\n")[1];
    expect(dataLine).toBe("Alice Chen,Bethel Crew House,01,2026-09-03,,,,,no");
    expect(csv).not.toContain("—");
  });

  it("distinguishes an unscored occupancy from zero percent", () => {
    const csv = occupancyCsv([
      { unitId: "u1", unitName: "New House", station: "PANC", rooms: 0, roomNights: 0, occupiedNights: 0, occupancyPct: null },
      { unitId: "u2", unitName: "Dorm B", station: "PADU", rooms: 2, roomNights: 20, occupiedNights: 0, occupancyPct: 0 },
    ]);
    const [, unscored, zero] = csv.split("\r\n");
    expect(unscored.endsWith(",")).toBe(true);   // no figure at all
    expect(zero.endsWith(",0.0")).toBe(true);    // a real 0%
  });

  it("uses CRLF and ends with a newline, for Excel", () => {
    const csv = toCsv(["a", "b"], [[1, 2]]);
    expect(csv).toBe("a,b\r\n1,2\r\n");
  });

  it("emits a header row even with no data", () => {
    expect(costCsv({ rows: [], total: 0, unpricedBookings: 0 })).toBe(
      "Employee,Nights,Cost,Unpriced Bookings\r\n",
    );
  });
});
