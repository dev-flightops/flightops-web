/**
 * Flight crew assignment — wraps ops-service /flights/{id}/crew
 * (flightops-services#171).
 *
 *   GET    /ops/flights/{id}/crew            the roster for one flight
 *   POST   /ops/flights/{id}/crew            put someone in a seat
 *   DELETE /ops/flights/{id}/crew/{user_id}  take them off it
 *
 * Reads are open to anyone in the tenant — a pilot needs to see who
 * they're flying with. Writes are dispatcher/exec_admin, enforced
 * server-side.
 *
 * Before this existed, the dispatch packet's PIC dropdown wrote its
 * choice to `?pic=<uuid>` and nowhere else. The dispatcher picked a
 * pilot, read their currency, released the flight — and the assignment
 * evaporated with the URL. The pilot's own "My Flights today" never
 * knew about it.
 */

import { apiFetch } from "./client";
import type { UserRef } from "./types";

export type CrewRole = "pic" | "sic" | "flight_attendant";

/** Seat, not job title. A captain flying a line check as SIC is SIC
 *  that day, and the roster should say so. */
export const CREW_ROLE_LABELS: Record<CrewRole, string> = {
  pic: "PIC",
  sic: "SIC",
  flight_attendant: "Flight Attendant",
};

export interface PicComplianceSummary {
  dot_color: "green" | "yellow" | "red";
  is_current: boolean;
  blocking_items?: unknown[];
}

export interface CrewAssignment {
  id: string;
  flight_id: string;
  user: UserRef;
  crew_role: CrewRole;
  assigned_at: string;
  assigned_by: UserRef | null;
  notes: string | null;
  /** Only present on the PIC, and only on a write. Advisory — assigning
   *  a non-current pilot is allowed (you may be rostering ahead of a
   *  check ride); flying them is what release refuses. */
  pic_compliance: PicComplianceSummary | null;
}

export interface CrewAssignmentList {
  items: CrewAssignment[];
  /** A flight cannot legally depart without a PIC, so the roster says
   *  so up front rather than leaving it to the release step. */
  has_pic: boolean;
}

export async function listFlightCrew(
  flightId: string,
): Promise<CrewAssignmentList> {
  return apiFetch<CrewAssignmentList>(`/ops/flights/${flightId}/crew`);
}

export async function assignFlightCrew(
  flightId: string,
  input: { user_id: string; crew_role: CrewRole; notes?: string | null },
): Promise<CrewAssignment> {
  return apiFetch<CrewAssignment>(`/ops/flights/${flightId}/crew`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function unassignFlightCrew(
  flightId: string,
  userId: string,
): Promise<void> {
  await apiFetch<void>(`/ops/flights/${flightId}/crew/${userId}`, {
    method: "DELETE",
  });
}
