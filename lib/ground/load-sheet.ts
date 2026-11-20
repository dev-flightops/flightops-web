import type { MailClass, ManifestCargoRow, ManifestDetailResponse, ManifestPaxRow } from "@/lib/api/manifest";
import type { FlightLeg } from "@/lib/api/types";

/**
 * A ramper's load sheet (#208): at each stop, in flying order, what comes
 * off and what goes on. The client, 20 Nov: "Rampers see when they are
 * tagged to a flight, but they don't know the manifest/weights to pull for
 * each stop."
 *
 * Legacy's ramper flight page listed the passengers ("170 lbs + 35 bag"),
 * the cargo and the mail of a flight with one origin and one destination.
 * A FlightOps flight can stop at several villages, and each passenger and
 * each mail or freight line says where it gets on and off (#120, LOG-40),
 * so the sheet groups them by stop.
 */

const lbs = (value: string | number | null | undefined): number => {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** The stops a passenger or line gets on and off at, as indexes into the
 *  route, the way ops counts seats (leg_seats.span): unset is the origin /
 *  destination; a route can come back to an airport, so boarding is the
 *  first stop with that code before the last, and leaving the first one
 *  after it. Null when a stop they name isn't on the route there. */
export function onAndOff(
  stops: readonly string[],
  boardsAt?: string | null,
  leavesAt?: string | null,
): { on: number; off: number } | null {
  const codes = stops.map((s) => s.trim().toUpperCase());
  const last = codes.length - 1;
  if (last < 1) return null;
  let on = 0;
  if (boardsAt) {
    on = codes.slice(0, last).indexOf(boardsAt.trim().toUpperCase());
    if (on < 0) return null;
  }
  let off = last;
  if (leavesAt) {
    off = codes.indexOf(leavesAt.trim().toUpperCase(), on + 1);
    if (off < 0) return null;
  }
  return { on, off };
}

export interface SheetBag {
  weightLbs: number;
  description: string | null;
}

export interface SheetPassenger {
  id: string;
  name: string;
  weightLbs: number;
  /** Checked bags, one by one, for the hold. Empty when the gate gave a
   *  total alone. */
  bags: SheetBag[];
  /** The checked bags' weight: theirs, or the baggage total. */
  bagLbs: number;
  /** How many checked bags; null when only a weight is known. */
  bagCount: number | null;
  /** Carried into the cabin, not the ramp's to load. */
  carryOns: number;
  checkedIn: boolean;
}

export interface SheetLine {
  id: string;
  description: string;
  pieces: number;
  weightLbs: number;
  mailClass: MailClass | null;
  isHazmat: boolean;
  hazmatNotes: string | null;
  consignee: string | null;
  notes: string | null;
}

export interface SheetGroup {
  passengers: SheetPassenger[];
  lines: SheetLine[];
  /** Bags, mail and freight, in pounds: what the ramp lifts. */
  lbs: number;
}

export interface StopSheet {
  index: number;
  icao: string;
  /** When the flight lands here and leaves here; null at the ends. */
  arrives: string | null;
  departs: string | null;
  off: SheetGroup;
  on: SheetGroup;
}

export interface LoadSheet {
  stops: StopSheet[];
  /** On the manifest for stops the route no longer flies: dispatch's to
   *  sort out, so the ramp asks before loading them. */
  notOnRoute: SheetGroup;
}

function passenger(row: ManifestPaxRow): SheetPassenger {
  const aboard = (row.bags ?? []).filter((bag) => bag.status === "aboard");
  const checked = aboard.filter((bag) => !bag.carry_on);
  const listed = aboard.length > 0;
  return {
    id: row.id,
    name: `${row.first_name} ${row.last_name}`.trim(),
    weightLbs: lbs(row.weight_lbs),
    bags: checked.map((bag) => ({ weightLbs: lbs(bag.weight_lbs), description: bag.description })),
    bagLbs: listed ? checked.reduce((sum, bag) => sum + lbs(bag.weight_lbs), 0) : lbs(row.baggage_lbs),
    bagCount: listed ? checked.length : (row.bags_count ?? null),
    carryOns: aboard.length - checked.length,
    checkedIn: row.check_in_status === "checked_in" || row.check_in_status === "boarded",
  };
}

function line(row: ManifestCargoRow): SheetLine {
  return {
    id: row.id,
    description: row.description,
    pieces: row.pieces,
    weightLbs: lbs(row.weight_lbs),
    mailClass: row.mail_class,
    isHazmat: row.is_hazmat,
    hazmatNotes: row.hazmat_notes,
    consignee: row.consignee,
    notes: row.notes,
  };
}

const empty = (): SheetGroup => ({ passengers: [], lines: [], lbs: 0 });

function add(group: SheetGroup, item: { passenger?: SheetPassenger; line?: SheetLine }) {
  if (item.passenger) {
    group.passengers.push(item.passenger);
    group.lbs += item.passenger.bagLbs;
  }
  if (item.line) {
    group.lines.push(item.line);
    group.lbs += item.line.weightLbs;
  }
}

/** The legs' times, by stop: when the flight lands at and leaves each. */
function stopTimes(stops: readonly string[], legs: readonly FlightLeg[], departs: string, arrives: string) {
  const ordered = [...legs].sort((a, b) => a.sequence - b.sequence);
  return stops.map((_, i) => {
    if (ordered.length === stops.length - 1) {
      return {
        arrives: i > 0 ? ordered[i - 1].scheduled_arrival_at : null,
        departs: i < ordered.length ? ordered[i].scheduled_departure_at : null,
      };
    }
    return { arrives: i === stops.length - 1 ? arrives : null, departs: i === 0 ? departs : null };
  });
}

export function loadSheet(
  flight: {
    stops: readonly string[];
    legs?: readonly FlightLeg[];
    scheduled_departure_at: string;
    scheduled_arrival_at: string;
  },
  manifest: Pick<ManifestDetailResponse, "pax" | "cargo"> | null,
): LoadSheet {
  const times = stopTimes(flight.stops, flight.legs ?? [], flight.scheduled_departure_at, flight.scheduled_arrival_at);
  const sheet: LoadSheet = {
    stops: flight.stops.map((icao, index) => ({
      index,
      icao,
      ...times[index],
      off: empty(),
      on: empty(),
    })),
    notOnRoute: empty(),
  };
  const place = (boardsAt: string | null | undefined, leavesAt: string | null | undefined, item: { passenger?: SheetPassenger; line?: SheetLine }) => {
    const at = onAndOff(flight.stops, boardsAt, leavesAt);
    if (!at) {
      add(sheet.notOnRoute, item);
      return;
    }
    add(sheet.stops[at.on].on, item);
    add(sheet.stops[at.off].off, item);
  };
  for (const row of manifest?.pax ?? []) {
    // Crew bring their own; a no-show's bags aren't at the ramp.
    if (row.is_crew || row.check_in_status === "no_show") continue;
    place(row.boards_at, row.leaves_at, { passenger: passenger(row) });
  }
  for (const row of manifest?.cargo ?? []) {
    place(row.boards_at, row.leaves_at, { line: line(row) });
  }
  return sheet;
}
