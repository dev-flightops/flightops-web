/**
 * The Mechanic Roster (#178): mechanics by base, the roster's own day tags,
 * and the days painted with them. The maintenance service's /mx-roster.
 *
 * The tag and paint shapes are the crew calendar's (lib/api/crew-calendar.ts),
 * so the two calendars share the palette and the tag dialogs.
 */

import { apiFetch } from "./client";
import type { ScheduleTag, ScheduleTagTone } from "./crew-calendar";

export interface MxRosterMechanic {
  user_id: string;
  full_name: string;
  station: string | null;
  title: string | null;
}

export interface MxRoster {
  month: string;
  first_day: string;
  last_day: string;
  /** The company's date. */
  today: string;
  base: string | null;
  /** The mechanics' home bases, for the filter. */
  bases: string[];
  mechanics: MxRosterMechanic[];
  tags: ScheduleTag[];
  cells: { user_id: string; cell_date: string; tag_id: string }[];
}

export async function getMxRoster(params: { month?: string; base?: string } = {}): Promise<MxRoster> {
  const qs = new URLSearchParams();
  if (params.month) qs.set("month", params.month);
  if (params.base) qs.set("base", params.base);
  const tail = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<MxRoster>(`/maintenance/mx-roster${tail}`);
}

export async function createMxTag(body: { label: string; tone: ScheduleTagTone }): Promise<ScheduleTag> {
  return apiFetch<ScheduleTag>(`/maintenance/mx-roster/tags`, { method: "POST", body: JSON.stringify(body) });
}

export async function updateMxTag(
  id: string,
  body: { label?: string; tone?: ScheduleTagTone; is_active?: boolean },
): Promise<ScheduleTag> {
  return apiFetch<ScheduleTag>(`/maintenance/mx-roster/tags/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export async function paintMxCells(body: {
  user_id: string;
  start_date: string;
  end_date: string;
  tag_id: string | null;
}): Promise<{ days: number; tag_id: string | null }> {
  return apiFetch(`/maintenance/mx-roster/cells`, { method: "PUT", body: JSON.stringify(body) });
}
