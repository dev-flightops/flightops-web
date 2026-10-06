"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import {
  createRosterEntry,
  createScheduleTag,
  deleteRosterEntry,
  DUTY_TYPES_NEEDING_AIRFRAME,
  moveCrewHomeStation,
  paintCrewDays,
  replaceRosterEntry,
  SCHEDULE_TAG_LABEL_MAX,
  SCHEDULE_TAG_TONES,
  updateScheduleTag,
  type DutyType,
  type ScheduleTagTone,
} from "@/lib/api/crew-calendar";

/**
 * Crew calendar writes (ops-service /crew-calendar).
 *
 * Called directly from the client components rather than as form
 * actions: the unit tests run React 18, which has neither useActionState
 * nor function form actions.
 *
 * The server's own messages are shown as they come — an overlap names
 * the assignment it collides with, and a bad base or type says which.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const DUTY: [DutyType, ...DutyType[]] = [
  "flying",
  "training",
  "standby",
  "off",
  "ferry",
  "check",
];

const blankToNull = (v: string | undefined) => (v ? v : null);

const EntrySchema = z
  .object({
    user_id: z.string().uuid("Pick a pilot."),
    station: z
      .string()
      .trim()
      .toUpperCase()
      .min(2, "Pick a base.")
      .max(10, "Pick a base."),
    duty_type: z.enum(DUTY, { message: "Pick a duty type." }),
    airframe_type: z
      .string()
      .trim()
      .toLowerCase()
      .max(40)
      .optional()
      .transform(blankToNull),
    aircraft_id: z
      .union([z.string().uuid(), z.literal("")])
      .optional()
      .transform(blankToNull),
    start_date: z.string().regex(ISO_DAY, "Pick a start date."),
    end_date: z.string().regex(ISO_DAY, "Pick an end date."),
    notes: z
      .string()
      .trim()
      .max(2000, "Keep the notes under 2,000 characters.")
      .optional()
      .transform(blankToNull),
  })
  .superRefine((v, ctx) => {
    if (v.end_date < v.start_date) {
      ctx.addIssue({
        code: "custom",
        message: "The end date is before the start date.",
        path: ["end_date"],
      });
    }
    if (
      !v.airframe_type &&
      !v.aircraft_id &&
      DUTY_TYPES_NEEDING_AIRFRAME.has(v.duty_type)
    ) {
      ctx.addIssue({
        code: "custom",
        message: `A ${v.duty_type} assignment needs an aircraft type.`,
        path: ["airframe_type"],
      });
    }
  });

const FIELDS = [
  "user_id",
  "station",
  "duty_type",
  "airframe_type",
  "aircraft_id",
  "start_date",
  "end_date",
  "notes",
] as const;

export async function saveAssignmentAction(
  formData: FormData,
): Promise<ActionResult> {
  const parsed = EntrySchema.safeParse(
    Object.fromEntries(FIELDS.map((k) => [k, String(formData.get(k) ?? "")])),
  );
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the form.",
    };
  }
  const entryId = String(formData.get("entry_id") ?? "");
  try {
    if (entryId) await replaceRosterEntry(entryId, parsed.data);
    else await createRosterEntry(parsed.data);
  } catch (err) {
    return { ok: false, error: messageFor(err, "save the assignment") };
  }
  revalidatePath("/crew");
  return { ok: true };
}

export async function deleteAssignmentAction(
  entryId: string,
): Promise<ActionResult> {
  try {
    await deleteRosterEntry(entryId);
  } catch (err) {
    return { ok: false, error: messageFor(err, "remove the assignment") };
  }
  revalidatePath("/crew");
  return { ok: true };
}

export async function moveHomeBaseAction(
  userId: string,
  station: string,
): Promise<ActionResult> {
  const code = station.trim().toUpperCase();
  if (!code) return { ok: false, error: "Pick a base." };
  try {
    await moveCrewHomeStation(userId, code);
  } catch (err) {
    return { ok: false, error: messageFor(err, "move the pilot") };
  }
  revalidatePath("/crew");
  return { ok: true };
}

// ---- Day tags (#44) ------------------------------------------------------

function tagLabel(raw: string): string | { error: string } {
  const label = raw.split(/\s+/).filter(Boolean).join(" ");
  if (!label) return { error: "Give the tag a label." };
  if (label.length > SCHEDULE_TAG_LABEL_MAX) {
    return { error: `Keep the label to ${SCHEDULE_TAG_LABEL_MAX} characters.` };
  }
  return label;
}

function isTone(tone: string): tone is ScheduleTagTone {
  return (SCHEDULE_TAG_TONES as readonly string[]).includes(tone);
}

export async function createTagAction(
  rawLabel: string,
  tone: string,
): Promise<ActionResult> {
  const label = tagLabel(rawLabel);
  if (typeof label !== "string") return { ok: false, error: label.error };
  if (!isTone(tone)) return { ok: false, error: "Pick a colour." };
  try {
    await createScheduleTag({ label, tone });
  } catch (err) {
    return { ok: false, error: messageFor(err, "add the tag") };
  }
  revalidatePath("/crew");
  return { ok: true };
}

export async function updateTagAction(
  tagId: string,
  patch: { label?: string; tone?: string; is_active?: boolean },
): Promise<ActionResult> {
  const body: { label?: string; tone?: ScheduleTagTone; is_active?: boolean } = {};
  if (patch.label !== undefined) {
    const label = tagLabel(patch.label);
    if (typeof label !== "string") return { ok: false, error: label.error };
    body.label = label;
  }
  if (patch.tone !== undefined) {
    if (!isTone(patch.tone)) return { ok: false, error: "Pick a colour." };
    body.tone = patch.tone;
  }
  if (patch.is_active !== undefined) body.is_active = patch.is_active;
  try {
    await updateScheduleTag(tagId, body);
  } catch (err) {
    return { ok: false, error: messageFor(err, "change the tag") };
  }
  revalidatePath("/crew");
  return { ok: true };
}

/** Paint a run of one pilot's days with a tag, or clear them (null). */
export async function paintDaysAction(
  userId: string,
  startDate: string,
  endDate: string,
  tagId: string | null,
): Promise<ActionResult> {
  if (!ISO_DAY.test(startDate) || !ISO_DAY.test(endDate)) {
    return { ok: false, error: "Pick the days again." };
  }
  const [start, end] = startDate <= endDate ? [startDate, endDate] : [endDate, startDate];
  try {
    await paintCrewDays({ user_id: userId, start_date: start, end_date: end, tag_id: tagId });
  } catch (err) {
    return { ok: false, error: messageFor(err, tagId ? "paint those days" : "clear those days") };
  }
  revalidatePath("/crew");
  return { ok: true };
}

function messageFor(err: unknown, verb: string): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Your session expired — please sign in again.";
    if (err.status === 403) {
      return "Only a Chief Pilot, Director of Operations or Exec Admin can change the crew calendar.";
    }
    const detail = detailOf(err.message);
    if (detail && [404, 409, 422].includes(err.status)) return detail;
    return `Couldn't ${verb} (HTTP ${err.status}). Try again.`;
  }
  return `Couldn't ${verb}. Try again.`;
}

/** FastAPI's own validation errors carry a list; ours carry a sentence. */
function detailOf(raw: string): string | null {
  try {
    const body = JSON.parse(raw) as { detail?: unknown };
    return typeof body.detail === "string" ? body.detail : null;
  } catch {
    return null;
  }
}
