"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ApiError } from "@/lib/api/client";
import {
  addScheduleRoute,
  changeScheduleRoute,
  createSchedule,
  publishSchedule,
  removeScheduleRoute,
  updateSchedule,
  withdrawPublication,
  type PublishResult,
  type ScheduleRouteInput,
} from "@/lib/api/master-schedule";
import { scheduleRefusal } from "@/lib/flights/schedule-refusals";

export interface ScheduleFormState {
  status: "idle" | "ok" | "error";
  message?: string;
  attempt: number;
}

export interface PublishFormState {
  status: "idle" | "preview" | "published" | "error";
  message?: string;
  result?: PublishResult;
  /** The dates the result is for: Publish only stands for what was previewed. */
  values?: { name: string; start_date: string; end_date: string };
  attempt: number;
}

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function detailOf(message: string): unknown {
  try {
    return (JSON.parse(message) as { detail?: unknown }).detail;
  } catch {
    return undefined;
  }
}

const REFUSALS: Record<string, string> = {
  arrival_must_be_after_departure:
    "Each leg has to arrive after it leaves, within 12 hours. An arrival after midnight is fine.",
  legs_not_continuous: "Each leg has to leave from where the last one landed.",
  legs_out_of_order: "A leg can't leave before the last one lands.",
  too_many_legs: "A flight can have 9 legs at most.",
  aircraft_not_active: "That aircraft isn't active. Pick another, or make it active under Settings, Fleet.",
  aircraft_not_found: "That aircraft is no longer in the fleet. Pick another.",
  schedule_not_found: "That schedule is gone. Refresh the page.",
  route_not_found: "That flight is no longer on the schedule. Refresh the page.",
  publication_not_found: "That publication is gone. Refresh the page.",
  publication_already_withdrawn: "That publication has already been withdrawn. Refresh the page.",
  end_before_start: "The end date can't be before the start date.",
  range_too_long: "A publication can cover a year at most. Publish a shorter range.",
  start_in_past: "The start date can't be before today.",
  schedule_inactive: "This schedule is inactive. Make it active to publish it.",
  schedule_has_no_flights: "Add a flight to the schedule first.",
  flight_number_conflict: "Someone built one of these flights just now. Preview again.",
};

function why(err: unknown): string {
  if (!(err instanceof ApiError)) return "Could not reach the server. Try again in a moment.";
  if (err.status === 401) return "Your session expired. Sign in again, then retry.";
  if (err.status === 403) return "Only a dispatcher or an Exec Admin can change the master schedule.";
  const refused = scheduleRefusal(err.message);
  if (refused) return refused;
  const detail = detailOf(err.message);
  if (typeof detail === "string" && REFUSALS[detail]) return REFUSALS[detail];
  if (detail && typeof detail === "object" && (detail as { error?: string }).error === "too_many_flights") {
    const { count, limit } = detail as unknown as { count: number; limit: number };
    return `That would add ${count} flights, more than the ${limit} one publication can. Publish a shorter range.`;
  }
  return `That was not saved (HTTP ${err.status}).`;
}

function refresh(templateId?: string): void {
  revalidatePath("/schedule/master");
  if (templateId) revalidatePath(`/schedule/master/${templateId}`);
}

/** A new schedule, then its page to add flights to. */
export async function createScheduleAction(
  prev: ScheduleFormState,
  formData: FormData,
): Promise<ScheduleFormState> {
  const attempt = prev.attempt + 1;
  const name = text(formData, "name");
  if (!name) return { status: "error", message: "Give the schedule a name.", attempt };
  let id: string;
  try {
    id = (await createSchedule({ name, description: text(formData, "description") || null })).id;
  } catch (err) {
    return { status: "error", message: why(err), attempt };
  }
  refresh();
  redirect(`/schedule/master/${id}`);
}

export async function updateScheduleAction(
  prev: ScheduleFormState,
  formData: FormData,
): Promise<ScheduleFormState> {
  const attempt = prev.attempt + 1;
  const id = text(formData, "template_id");
  const name = text(formData, "name");
  if (!name) return { status: "error", message: "Give the schedule a name.", attempt };
  try {
    await updateSchedule(id, {
      name,
      description: text(formData, "description") || null,
      is_active: formData.get("is_active") === "on",
    });
  } catch (err) {
    return { status: "error", message: why(err), attempt };
  }
  refresh(id);
  return { status: "ok", message: "Saved.", attempt };
}

/** Add a flight to a schedule, or change one (`route_id`). The legs come as
 *  rows: one origin, then a destination and two times for each leg. */
export async function saveRouteAction(prev: ScheduleFormState, formData: FormData): Promise<ScheduleFormState> {
  const attempt = prev.attempt + 1;
  const fail = (message: string): ScheduleFormState => ({ status: "error", message, attempt });
  const id = text(formData, "template_id");
  const routeId = text(formData, "route_id");

  const flightNumber = text(formData, "flight_number");
  if (!flightNumber) return fail("Enter the flight number.");
  const aircraftId = text(formData, "aircraft_id");
  if (!aircraftId) return fail("Pick the aircraft.");

  const destinations = formData.getAll("leg_destination").map((v) => String(v).trim().toUpperCase());
  const departures = formData.getAll("leg_departs").map(String);
  const arrivals = formData.getAll("leg_arrives").map(String);
  let from = text(formData, "origin").toUpperCase();
  if (!from) return fail("Enter where the flight leaves from.");
  const legs: ScheduleRouteInput["legs"] = [];
  for (let i = 0; i < destinations.length; i++) {
    if (!destinations[i]) return fail(`Leg ${i + 1} needs a destination.`);
    if (!CLOCK.test(departures[i] ?? "") || !CLOCK.test(arrivals[i] ?? "")) {
      return fail(`Leg ${i + 1} needs both its times.`);
    }
    legs.push({ origin: from, destination: destinations[i], departs: departures[i], arrives: arrivals[i] });
    from = destinations[i];
  }
  if (legs.length === 0) return fail("Enter where the flight goes.");

  const days = formData
    .getAll("dow")
    .map(Number)
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  if (days.length === 0) return fail("Pick at least one day it operates.");

  const body: ScheduleRouteInput = {
    flight_number: flightNumber,
    aircraft_id: aircraftId,
    legs,
    days_of_week: days,
    is_ifr: formData.get("is_ifr") === "on",
    notes: text(formData, "notes") || null,
  };
  try {
    if (routeId) await changeScheduleRoute(id, routeId, body);
    else await addScheduleRoute(id, body);
  } catch (err) {
    return fail(why(err));
  }
  refresh(id);
  return { status: "ok", attempt };
}

export async function removeRouteAction(
  templateId: string,
  routeId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await removeScheduleRoute(templateId, routeId);
  } catch (err) {
    return { ok: false, error: why(err) };
  }
  refresh(templateId);
  return { ok: true };
}

/** Preview a date range, or publish what was previewed (`intent`). */
export async function publishAction(prev: PublishFormState, formData: FormData): Promise<PublishFormState> {
  const attempt = prev.attempt + 1;
  const id = text(formData, "template_id");
  const values = {
    name: text(formData, "name"),
    start_date: text(formData, "start_date"),
    end_date: text(formData, "end_date"),
  };
  if (!values.start_date || !values.end_date) {
    return { status: "error", message: "Enter the start and end dates.", values, attempt };
  }
  const preview = text(formData, "intent") !== "publish";
  let result: PublishResult;
  try {
    result = await publishSchedule(id, {
      name: values.name || null,
      start_date: values.start_date,
      end_date: values.end_date,
      preview,
    });
  } catch (err) {
    return { status: "error", message: why(err), values, attempt };
  }
  if (!preview) {
    refresh(id);
    revalidatePath("/schedule");
  }
  return { status: preview ? "preview" : "published", result, values, attempt };
}

export async function withdrawAction(
  publicationId: string,
  templateId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await withdrawPublication(publicationId);
  } catch (err) {
    return { ok: false, error: why(err) };
  }
  refresh(templateId);
  revalidatePath("/schedule");
  return { ok: true };
}
