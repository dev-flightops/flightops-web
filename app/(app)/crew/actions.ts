"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import {
  createRosterEntry,
  deleteRosterEntry,
  DUTY_TYPES_NEEDING_AIRFRAME,
  moveCrewHomeStation,
  replaceRosterEntry,
  type DutyType,
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
