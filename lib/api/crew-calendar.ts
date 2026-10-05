/**
 * Crew calendar — wraps ops-service /crew-calendar (flightops-services#266).
 *
 *   GET    /ops/crew-calendar?month=YYYY-MM&station=  the month view
 *   POST   /ops/crew-calendar/entries                 add an assignment
 *   PUT    /ops/crew-calendar/entries/{id}            change one
 *   DELETE /ops/crew-calendar/entries/{id}            remove one
 *   PUT    /ops/crew-calendar/crew/{userId}/station   move a pilot's home base
 *   POST   /ops/crew-calendar/tags                    add a day tag
 *   PATCH  /ops/crew-calendar/tags/{id}               rename, recolour, archive
 *   PUT    /ops/crew-calendar/cells                   paint or clear a run of days
 *
 * Reads are open to staff; writes need CREW_SCHEDULERS, enforced
 * server-side. A pilot holds one assignment per day: the API refuses an
 * overlap (409) and names the assignment it collides with.
 */

import { apiFetch } from "./client";

export type DutyType =
  | "flying"
  | "training"
  | "standby"
  | "off"
  | "ferry"
  | "check";

/** Legacy's duty types, in its order. */
export const DUTY_TYPES: readonly DutyType[] = [
  "flying",
  "training",
  "standby",
  "off",
  "ferry",
  "check",
];

export const DUTY_TYPE_LABELS: Record<DutyType, string> = {
  flying: "Flying",
  training: "Training",
  standby: "Standby",
  off: "Off",
  ferry: "Ferry",
  check: "Check",
};

/** Duty types that put the pilot in an aircraft; the API requires a type. */
export const DUTY_TYPES_NEEDING_AIRFRAME: ReadonlySet<DutyType> = new Set([
  "flying",
  "ferry",
  "check",
]);

/** The theme's status tones, in the order the colour picker offers them.
 *  A tag's colour is one of these, never free hex (#44). */
export type ScheduleTagTone =
  | "blue"
  | "green"
  | "yellow"
  | "orange"
  | "red"
  | "purple"
  | "teal"
  | "gray";

export const SCHEDULE_TAG_TONES: readonly ScheduleTagTone[] = [
  "blue",
  "green",
  "yellow",
  "orange",
  "red",
  "purple",
  "teal",
  "gray",
];

/** Drawn in a 30px day cell; the full label shows on hover. */
export const SCHEDULE_TAG_LABEL_MAX = 16;

export interface ScheduleTag {
  id: string;
  label: string;
  tone: ScheduleTagTone;
  sort_order: number;
  /** Archived tags leave the palette but keep the days painted with them. */
  is_active: boolean;
}

export interface CrewCalendarCell {
  user_id: string;
  cell_date: string;
  tag_id: string;
}

export interface CrewCalendarStation {
  code: string;
  name: string;
}

export interface CrewCalendarAircraft {
  id: string;
  tail_number: string;
  airframe_type: string;
}

export interface CrewCalendarMember {
  user_id: string;
  full_name: string;
  station: string | null;
  roles: string[];
}

export interface CrewCalendarGroup {
  /** null for crew with no home base, listed last. */
  station: string | null;
  label: string;
  crew: CrewCalendarMember[];
}

export interface RosterEntry {
  id: string;
  user_id: string;
  station: string;
  airframe_type: string | null;
  aircraft_id: string | null;
  tail_number: string | null;
  start_date: string;
  end_date: string;
  duty_type: DutyType;
  notes: string | null;
}

export interface CrewCalendar {
  month: string;
  first_day: string;
  last_day: string;
  station: string | null;
  /** The filter's choices: crew home bases and bases with an assignment
   *  this month, whatever filter is applied. */
  bases: string[];
  stations: CrewCalendarStation[];
  airframe_types: string[];
  aircraft: CrewCalendarAircraft[];
  groups: CrewCalendarGroup[];
  entries: RosterEntry[];
  /** Every tag, archived ones last, so a painted day can name its tag. */
  tags: ScheduleTag[];
  /** Tagged days in the month, for the crew shown. */
  cells: CrewCalendarCell[];
}

export interface RosterEntryInput {
  user_id: string;
  station: string;
  airframe_type: string | null;
  aircraft_id: string | null;
  start_date: string;
  end_date: string;
  duty_type: DutyType;
  notes: string | null;
}

export async function getCrewCalendar(params: {
  month: string;
  station?: string | null;
}): Promise<CrewCalendar> {
  const qs = new URLSearchParams({ month: params.month });
  if (params.station) qs.set("station", params.station);
  return apiFetch<CrewCalendar>(`/ops/crew-calendar?${qs.toString()}`);
}

export async function createRosterEntry(
  input: RosterEntryInput,
): Promise<RosterEntry> {
  return apiFetch<RosterEntry>("/ops/crew-calendar/entries", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function replaceRosterEntry(
  id: string,
  input: RosterEntryInput,
): Promise<RosterEntry> {
  return apiFetch<RosterEntry>(`/ops/crew-calendar/entries/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function deleteRosterEntry(id: string): Promise<void> {
  await apiFetch<void>(`/ops/crew-calendar/entries/${id}`, {
    method: "DELETE",
  });
}

export async function moveCrewHomeStation(
  userId: string,
  station: string,
): Promise<CrewCalendarMember> {
  return apiFetch<CrewCalendarMember>(
    `/ops/crew-calendar/crew/${userId}/station`,
    { method: "PUT", body: JSON.stringify({ station }) },
  );
}

export async function createScheduleTag(input: {
  label: string;
  tone: ScheduleTagTone;
}): Promise<ScheduleTag> {
  return apiFetch<ScheduleTag>("/ops/crew-calendar/tags", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateScheduleTag(
  id: string,
  patch: { label?: string; tone?: ScheduleTagTone; is_active?: boolean },
): Promise<ScheduleTag> {
  return apiFetch<ScheduleTag>(`/ops/crew-calendar/tags/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

/** Paint one tag on a run of one pilot's days, or clear them (tagId null). */
export async function paintCrewDays(input: {
  user_id: string;
  start_date: string;
  end_date: string;
  tag_id: string | null;
}): Promise<{ days: number; tag_id: string | null }> {
  return apiFetch<{ days: number; tag_id: string | null }>(
    "/ops/crew-calendar/cells",
    { method: "PUT", body: JSON.stringify(input) },
  );
}
