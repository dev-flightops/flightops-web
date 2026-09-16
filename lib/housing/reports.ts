/**
 * Housing report arithmetic.
 *
 * Pure functions, no imports from the API layer, so the maths is
 * testable without a server. The reports page fetches and renders;
 * everything that could be wrong by a day lives here.
 *
 * WHERE THE NUMBERS COME FROM
 *
 * Legacy computes its occupancy report over a date range
 * (`/housing/api/reports/occupancy`) as room-days vs occupied-days.
 * Our housing-service exposes `GET /housing/occupancy`, which is a
 * single-date snapshot — useful for "who is in the building tonight",
 * not for a month's utilisation. So the range arithmetic is done here
 * over the booking list, which is the same source legacy aggregates.
 *
 * NIGHTS, NOT DAYS
 *
 * A booking with check_in 3 Sep and check_out 5 Sep occupies two
 * nights — the 3rd and the 4th. The guest is gone on the 5th. So the
 * bounds are half-open: [check_in, check_out). Counting it as three
 * would overstate every occupancy figure and every cost by one night
 * per booking, which on a 40-booking month is a 40-night error in a
 * number somebody invoices against.
 *
 * An open-ended booking (check_out null) is someone still resident.
 * It is clamped to the end of the report window rather than treated
 * as zero — a crew member housed indefinitely is the opposite of an
 * empty room.
 */

/** Minimal shapes, structural rather than imported, so this module
 *  stays free of the API layer. */
export interface ReportBooking {
  id: string;
  room_id: string;
  room_number: string | null;
  unit_id: string | null;
  unit_name: string | null;
  employee_user_id: string;
  employee_name: string | null;
  check_in: string;
  check_out: string | null;
  purpose: string | null;
  is_cancelled: boolean;
}

export interface ReportRoom {
  id: string;
  unit_id: string;
  room_number: string;
  capacity: number;
  cost_per_night: string | number | null;
}

export interface ReportUnit {
  id: string;
  name: string;
  station: string;
}

const MS_PER_DAY = 86_400_000;

/** Parse a YYYY-MM-DD date as UTC midnight. Local-time parsing would
 *  shift the day for anyone west of UTC and silently move a booking
 *  across a boundary. */
export function parseDay(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, (m ?? 1) - 1, d ?? 1);
}

export function dayCount(fromIso: string, toIso: string): number {
  // Inclusive of both ends: a report "from the 1st to the 1st" covers
  // one night, not zero.
  const days = (parseDay(toIso) - parseDay(fromIso)) / MS_PER_DAY + 1;
  return days > 0 ? days : 0;
}

/**
 * Nights a booking occupies inside [fromIso, toIso], where the report
 * window is inclusive of both ends and the booking is half-open.
 */
export function nightsInWindow(
  booking: Pick<ReportBooking, "check_in" | "check_out">,
  fromIso: string,
  toIso: string,
): number {
  const winStart = parseDay(fromIso);
  // The window's last night is `toIso`, so the exclusive end is the
  // day after it.
  const winEnd = parseDay(toIso) + MS_PER_DAY;
  const start = Math.max(parseDay(booking.check_in), winStart);
  const end = Math.min(
    booking.check_out ? parseDay(booking.check_out) : winEnd,
    winEnd,
  );
  const nights = (end - start) / MS_PER_DAY;
  return nights > 0 ? nights : 0;
}

/** Total nights a booking runs, ignoring any window. Null check_out
 *  means still resident, which has no total yet. */
export function totalNights(
  booking: Pick<ReportBooking, "check_in" | "check_out">,
): number | null {
  if (!booking.check_out) return null;
  const n = (parseDay(booking.check_out) - parseDay(booking.check_in)) / MS_PER_DAY;
  return n > 0 ? n : 0;
}

export function roomCost(room: ReportRoom | undefined): number | null {
  if (!room || room.cost_per_night === null || room.cost_per_night === undefined) {
    return null;
  }
  const n =
    typeof room.cost_per_night === "number"
      ? room.cost_per_night
      : Number.parseFloat(room.cost_per_night);
  return Number.isFinite(n) ? n : null;
}

export interface OccupancyRow {
  unitId: string;
  unitName: string;
  station: string;
  rooms: number;
  /** rooms x nights in the window — the denominator. */
  roomNights: number;
  occupiedNights: number;
  /** null when there are no room-nights to divide by, rather than 0% —
   *  a station with no rooms is not a station running at zero
   *  occupancy. */
  occupancyPct: number | null;
}

export function occupancyByUnit(
  units: readonly ReportUnit[],
  rooms: readonly ReportRoom[],
  bookings: readonly ReportBooking[],
  fromIso: string,
  toIso: string,
): OccupancyRow[] {
  const nights = dayCount(fromIso, toIso);
  const roomsByUnit = new Map<string, ReportRoom[]>();
  for (const r of rooms) {
    const list = roomsByUnit.get(r.unit_id) ?? [];
    list.push(r);
    roomsByUnit.set(r.unit_id, list);
  }
  const roomUnit = new Map(rooms.map((r) => [r.id, r.unit_id]));

  const occupied = new Map<string, number>();
  for (const b of bookings) {
    if (b.is_cancelled) continue;
    const unitId = b.unit_id ?? roomUnit.get(b.room_id);
    if (!unitId) continue;
    occupied.set(
      unitId,
      (occupied.get(unitId) ?? 0) + nightsInWindow(b, fromIso, toIso),
    );
  }

  return units
    .map((u) => {
      const unitRooms = roomsByUnit.get(u.id) ?? [];
      const roomNights = unitRooms.length * nights;
      const occupiedNights = occupied.get(u.id) ?? 0;
      return {
        unitId: u.id,
        unitName: u.name,
        station: u.station,
        rooms: unitRooms.length,
        roomNights,
        occupiedNights,
        occupancyPct:
          roomNights > 0 ? (occupiedNights / roomNights) * 100 : null,
      };
    })
    .sort((a, b) => a.station.localeCompare(b.station) || a.unitName.localeCompare(b.unitName));
}

export interface HistoryRow {
  bookingId: string;
  employee: string;
  unitName: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string | null;
  nights: number | null;
  cost: number | null;
  purpose: string | null;
  isCancelled: boolean;
}

export function employeeHistory(
  bookings: readonly ReportBooking[],
  rooms: readonly ReportRoom[],
): HistoryRow[] {
  const byId = new Map(rooms.map((r) => [r.id, r]));
  return bookings
    .map((b) => {
      const nights = totalNights(b);
      const rate = roomCost(byId.get(b.room_id));
      return {
        bookingId: b.id,
        // An unnamed employee is a data problem, not a blank cell —
        // say so rather than rendering an empty row.
        employee: b.employee_name ?? "(unknown employee)",
        unitName: b.unit_name ?? "—",
        roomNumber: b.room_number ?? "—",
        checkIn: b.check_in,
        checkOut: b.check_out,
        nights,
        // Cost needs both a rate and a finished stay. Either missing
        // means not computable, which is different from $0.
        cost: nights !== null && rate !== null ? nights * rate : null,
        purpose: b.purpose,
        isCancelled: b.is_cancelled,
      };
    })
    .sort(
      (a, b) =>
        a.employee.localeCompare(b.employee) ||
        b.checkIn.localeCompare(a.checkIn),
    );
}

export interface CostRow {
  employee: string;
  nights: number;
  cost: number;
  /** Bookings that had no rate on the room, so the cost above is a
   *  partial figure. Surfaced rather than hidden. */
  unpricedBookings: number;
}

export interface CostReport {
  rows: CostRow[];
  total: number;
  unpricedBookings: number;
}

export function costByEmployee(
  bookings: readonly ReportBooking[],
  rooms: readonly ReportRoom[],
  fromIso: string,
  toIso: string,
): CostReport {
  const byId = new Map(rooms.map((r) => [r.id, r]));
  const acc = new Map<string, CostRow>();
  let unpriced = 0;

  for (const b of bookings) {
    if (b.is_cancelled) continue;
    const nights = nightsInWindow(b, fromIso, toIso);
    if (nights <= 0) continue;
    const name = b.employee_name ?? "(unknown employee)";
    const row =
      acc.get(name) ?? { employee: name, nights: 0, cost: 0, unpricedBookings: 0 };
    row.nights += nights;
    const rate = roomCost(byId.get(b.room_id));
    if (rate === null) {
      row.unpricedBookings += 1;
      unpriced += 1;
    } else {
      row.cost += nights * rate;
    }
    acc.set(name, row);
  }

  const rows = [...acc.values()].sort(
    (a, b) => b.cost - a.cost || a.employee.localeCompare(b.employee),
  );
  return {
    rows,
    total: rows.reduce((s, r) => s + r.cost, 0),
    unpricedBookings: unpriced,
  };
}

// ---- CSV ------------------------------------------------------------------
//
// Built here rather than from the rendered table, which is how legacy
// does it (`exportTable('occ-table', ...)` scrapes the DOM). Scraping
// the table exports whatever the table happens to show — including the
// em-dashes this page renders for "not computable" — so a blank cost
// would leave the spreadsheet as "—" rather than empty. Building from
// the data keeps an unknown value empty and a real zero as 0.

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(
  headers: readonly string[],
  rows: readonly (readonly (string | number | null | undefined)[])[],
): string {
  // CRLF and a trailing newline: Excel is the destination for these.
  return [headers, ...rows]
    .map((r) => r.map(csvCell).join(","))
    .join("\r\n")
    .concat("\r\n");
}

export function occupancyCsv(rows: readonly OccupancyRow[]): string {
  return toCsv(
    ["House", "Station", "Rooms", "Room-Nights", "Occupied Nights", "Occupancy %"],
    rows.map((r) => [
      r.unitName,
      r.station,
      r.rooms,
      r.roomNights,
      r.occupiedNights,
      r.occupancyPct === null ? null : r.occupancyPct.toFixed(1),
    ]),
  );
}

export function historyCsv(rows: readonly HistoryRow[]): string {
  return toCsv(
    ["Employee", "House", "Room", "Check In", "Check Out", "Nights", "Cost", "Purpose", "Cancelled"],
    rows.map((r) => [
      r.employee,
      r.unitName,
      r.roomNumber,
      r.checkIn,
      r.checkOut,
      r.nights,
      r.cost === null ? null : r.cost.toFixed(2),
      r.purpose,
      r.isCancelled ? "yes" : "no",
    ]),
  );
}

export function costCsv(report: CostReport): string {
  return toCsv(
    ["Employee", "Nights", "Cost", "Unpriced Bookings"],
    report.rows.map((r) => [
      r.employee,
      r.nights,
      r.cost.toFixed(2),
      r.unpricedBookings || null,
    ]),
  );
}
