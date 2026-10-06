import type {
  TypeCellState,
  TypeCheck,
  TypePosition,
} from "@/lib/api/type-qualifications";

/**
 * How type qualifications read on screen (#45): the pilot page, the
 * overview grid and the roster's Aircraft column all use these, so the
 * three say the same thing in the same colours.
 *
 * Kept apart from lib/api so a component that only displays them does
 * not pull the API client, and its session code, into a test.
 */

/** 135ACM's columns, in its order. */
export const TYPE_POSITIONS: readonly TypePosition[] = [
  "pic",
  "sic",
  "instructor",
  "check_airman",
  "advisory",
];

export const POSITION_LABELS: Record<TypePosition, string> = {
  pic: "PIC",
  sic: "SIC",
  instructor: "Instructor",
  check_airman: "Check Airman",
  advisory: "Advisory Pilot",
};

/** What fits in a chip. */
export const POSITION_SHORT: Record<TypePosition, string> = {
  pic: "PIC",
  sic: "SIC",
  instructor: "INS",
  check_airman: "CA",
  advisory: "ADV",
};

export const CHECK_LABELS: Record<TypeCheck, string> = {
  competency: "Competency check (135.293)",
  instrument: "Instrument check (135.297)",
};

export const CELL_STATE_LABELS: Record<TypeCellState, string> = {
  current: "Current",
  grace: "Grace month",
  non_current: "Not current",
  not_authorised: "Not authorised",
};

/** Green, yellow and red are the currency board's current, grace and
 *  non-current. */
export const CELL_TONES: Record<TypeCellState, string> = {
  current: "bg-status-green/15 text-status-green",
  grace: "bg-status-yellow/15 text-status-yellow",
  non_current: "bg-status-red/15 text-status-red",
  not_authorised: "text-muted-foreground",
};

/** The fleet's slugs ("kingair") as the crew calendar prints them. */
export function typeLabel(airframeType: string): string {
  return airframeType.toUpperCase();
}
