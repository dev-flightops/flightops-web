import { apiFetch } from "@/lib/api/client";

/**
 * The master schedule (#168): ops' /master-schedule. Named schedules of the
 * flights the company flies every week, published to date ranges.
 */

export interface ScheduleLeg {
  origin: string;
  destination: string;
  /** "HH:MM", the clock at the first origin. Earlier than the time before
   *  it means the next day. */
  departs: string;
  arrives: string;
}

export interface ScheduleRoute {
  id: string;
  flight_number: string;
  aircraft: { id: string; tail_number: string; model: string; is_active: boolean };
  legs: ScheduleLeg[];
  /** 0 is Monday, 6 is Sunday. */
  days_of_week: number[];
  is_ifr: boolean;
  notes: string | null;
}

export interface PublicationProblem {
  date: string;
  flight_number: string;
  code: string;
  message: string;
}

export interface SchedulePublication {
  id: string;
  template_id: string;
  template_name: string;
  name: string;
  start_date: string;
  end_date: string;
  published_at: string;
  published_by: string | null;
  flights_created: number;
  flights_already_there: number;
  problem_count: number;
  problems: PublicationProblem[];
  withdrawn_at: string | null;
  withdrawn_by: string | null;
  flights_removed: number | null;
}

export interface ScheduleSummary {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  route_count: number;
  last_publication: SchedulePublication | null;
}

export interface ScheduleDetail extends ScheduleSummary {
  routes: ScheduleRoute[];
  publications: SchedulePublication[];
}

export interface ScheduleRouteInput {
  flight_number: string;
  aircraft_id: string;
  legs: ScheduleLeg[];
  days_of_week: number[];
  is_ifr: boolean;
  notes: string | null;
}

export interface PublishResult {
  preview: boolean;
  flights: number;
  by_flight: { flight_number: string; count: number }[];
  first_date: string | null;
  last_date: string | null;
  already_there: number;
  problem_count: number;
  problems: PublicationProblem[];
  publication_id: string | null;
}

export async function listSchedules(): Promise<{
  items: ScheduleSummary[];
  publications: SchedulePublication[];
}> {
  return apiFetch("/ops/master-schedule");
}

export async function getSchedule(id: string): Promise<ScheduleDetail> {
  return apiFetch<ScheduleDetail>(`/ops/master-schedule/${id}`);
}

export async function createSchedule(body: { name: string; description: string | null }): Promise<ScheduleSummary> {
  return apiFetch<ScheduleSummary>("/ops/master-schedule", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateSchedule(
  id: string,
  body: { name: string; description: string | null; is_active: boolean },
): Promise<ScheduleSummary> {
  return apiFetch<ScheduleSummary>(`/ops/master-schedule/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function addScheduleRoute(id: string, body: ScheduleRouteInput): Promise<ScheduleRoute> {
  return apiFetch<ScheduleRoute>(`/ops/master-schedule/${id}/routes`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function changeScheduleRoute(
  id: string,
  routeId: string,
  body: ScheduleRouteInput,
): Promise<ScheduleRoute> {
  return apiFetch<ScheduleRoute>(`/ops/master-schedule/${id}/routes/${routeId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function removeScheduleRoute(id: string, routeId: string): Promise<void> {
  await apiFetch<void>(`/ops/master-schedule/${id}/routes/${routeId}`, { method: "DELETE" });
}

export async function publishSchedule(
  id: string,
  body: { name: string | null; start_date: string; end_date: string; preview: boolean },
): Promise<PublishResult> {
  return apiFetch<PublishResult>(`/ops/master-schedule/${id}/publish`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function withdrawPublication(id: string): Promise<{ removed: number; kept: number }> {
  return apiFetch(`/ops/master-schedule/publications/${id}/withdraw`, { method: "POST" });
}
