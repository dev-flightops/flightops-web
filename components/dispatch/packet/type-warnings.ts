import type { TypeQualificationGrid } from "@/lib/api/type-qualifications";

/**
 * Crew warnings for the flight's aircraft type (#46): per pilot, what is
 * wrong with them in the PIC seat and in the SIC seat, or null.
 *
 * A warning, not a refusal. Assigning a pilot ahead of their check ride
 * is ordinary planning; release is where the PIC is enforced. Server
 * safe, so the dispatch page builds these and the client components
 * only print them.
 */
export interface SeatTypeWarning {
  pic: string | null;
  sic: string | null;
}

const PROBLEM: Record<string, string> = {
  not_authorised: "not authorised",
  non_current: "not current",
};

/** Only where the company enforces aircraft qualifications: before
 *  that the grid may be half entered and every pilot would carry one. */
export function typeWarnings(
  grid: TypeQualificationGrid | null,
  airframeType: string | null | undefined,
): Map<string, SeatTypeWarning> {
  const warnings = new Map<string, SeatTypeWarning>();
  const type = airframeType?.trim().toLowerCase();
  if (!grid?.enforced || !type) return warnings;
  const label = type.toUpperCase();
  for (const row of grid.pilots) {
    const seat = (position: "pic" | "sic"): string | null => {
      const cell = row.cells.find(
        (c) => c.airframe_type === type && c.position === position,
      );
      // A type the grid doesn't list: nobody holds it.
      const problem = PROBLEM[cell?.state ?? "not_authorised"];
      return problem ? `${problem} as ${position.toUpperCase()} on ${label}` : null;
    };
    const pic = seat("pic");
    const sic = seat("sic");
    if (pic || sic) warnings.set(row.pilot.id, { pic, sic });
  }
  return warnings;
}
