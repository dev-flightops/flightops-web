"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import { logCurrencyCompletion } from "@/lib/api/ops";
import {
  authoriseTypePosition,
  revokeTypePosition,
  type TypePosition,
} from "@/lib/api/type-qualifications";

/**
 * Type qualification writes (#45): authorise or revoke a position on an
 * aircraft type, and record a check ride flown in one.
 *
 * Called directly from the client components rather than as form
 * actions: the unit tests run React 18, which has neither useActionState
 * nor function form actions.
 *
 * A check ride is an ordinary currency completion that names the type,
 * so one entry moves the currency board and the type's positions alike.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const POSITIONS: [TypePosition, ...TypePosition[]] = [
  "pic",
  "sic",
  "instructor",
  "check_airman",
  "advisory",
];

const blankToNull = (v: string | undefined) => (v ? v : null);
const isUuid = (v: string) => z.string().uuid().safeParse(v).success;
const STALE: ActionResult = { ok: false, error: "Refresh the page and try again." };
const notes = z
  .string()
  .trim()
  .max(2000, "Keep the notes under 2,000 characters.")
  .optional()
  .transform(blankToNull);
const airframeType = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Pick an aircraft type.")
  .max(40, "Pick an aircraft type.");
const notFuture = (day: string) => day <= todayIso();

const AuthoriseSchema = z.object({
  airframe_type: airframeType,
  position: z.enum(POSITIONS, { message: "Pick a position." }),
  authorised_on: z
    .string()
    .regex(ISO_DAY, "Pick the date it was authorised.")
    .refine(notFuture, "The date can't be in the future."),
  notes,
});

const RevokeSchema = z.object({
  revoked_on: z
    .string()
    .regex(ISO_DAY, "Pick the date it was revoked.")
    .refine(notFuture, "The date can't be in the future."),
  notes,
});

const CheckRideSchema = z.object({
  currency_item_id: z
    .string()
    .uuid("This check isn't set up as a currency item yet."),
  airframe_type: airframeType,
  completion_date: z
    .string()
    .regex(ISO_DAY, "Pick the date of the check.")
    .refine(notFuture, "The date can't be in the future."),
  result: z.enum(["pass", "fail"], { message: "Pick Pass or Fail." }),
  completed_by: z
    .string()
    .trim()
    .min(1, "Name the examiner.")
    .max(200, "Keep the examiner's name under 200 characters."),
  examiner_cert_number: z
    .string()
    .trim()
    .max(64, "Keep the certificate number under 64 characters.")
    .optional()
    .transform(blankToNull),
  notes,
});

export async function authorisePositionAction(
  pilotId: string,
  input: z.input<typeof AuthoriseSchema>,
): Promise<ActionResult> {
  if (!isUuid(pilotId)) return STALE;
  const parsed = AuthoriseSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  try {
    await authoriseTypePosition(pilotId, parsed.data);
  } catch (err) {
    return { ok: false, error: messageFor(err, "authorise the position", ADMIN_ROLES) };
  }
  refresh(pilotId);
  return { ok: true };
}

export async function revokePositionAction(
  pilotId: string,
  qualificationId: string,
  input: z.input<typeof RevokeSchema>,
): Promise<ActionResult> {
  if (!isUuid(pilotId) || !isUuid(qualificationId)) return STALE;
  const parsed = RevokeSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  try {
    await revokeTypePosition(qualificationId, parsed.data);
  } catch (err) {
    return { ok: false, error: messageFor(err, "revoke the position", ADMIN_ROLES) };
  }
  refresh(pilotId);
  return { ok: true };
}

export async function recordCheckRideAction(
  pilotId: string,
  input: z.input<typeof CheckRideSchema>,
): Promise<ActionResult> {
  if (!isUuid(pilotId)) return STALE;
  const parsed = CheckRideSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  try {
    await logCurrencyCompletion({
      pilot_user_id: pilotId,
      score: null,
      ...parsed.data,
    });
  } catch (err) {
    return { ok: false, error: messageFor(err, "record the check", SIGNOFF_ROLES) };
  }
  refresh(pilotId);
  revalidatePath("/compliance/crew-currency");
  return { ok: true };
}

function refresh(pilotId: string) {
  revalidatePath(`/compliance/pilots/${pilotId}`);
  revalidatePath("/compliance/type-qualifications");
  revalidatePath("/compliance/roster");
}

function firstIssue(error: z.ZodError): ActionResult {
  return { ok: false, error: error.issues[0]?.message ?? "Check the form." };
}

const ADMIN_ROLES = "a Chief Pilot, Director of Operations or Exec Admin";
const SIGNOFF_ROLES = "a Chief Pilot, Check Airman, Director of Operations or Exec Admin";

/** The service answers with codes; these are what they mean here. */
const DETAILS: Record<string, string> = {
  position_already_authorised:
    "That position is already authorised on this type. Refresh the page to see it.",
  unknown_airframe_type: "That aircraft type isn't in the fleet.",
  authorised_on_in_future: "The date can't be in the future.",
  revoked_on_in_future: "The date can't be in the future.",
  revoked_before_authorised:
    "The revoked date is before the date the position was authorised.",
  qualification_not_found:
    "That authorisation no longer exists. Refresh the page.",
  already_revoked: "That position was already revoked. Refresh the page.",
  pilot_not_found: "That pilot is no longer on this company's roster.",
  currency_item_not_found: "That check is no longer an active currency item.",
  airframe_type_not_for_this_item:
    "Only a competency or instrument check can name an aircraft type.",
  completion_date_in_future: "The date can't be in the future.",
  result_required_for_check_event: "Pick Pass or Fail.",
  examiner_cert_required: "This check needs the examiner's certificate number.",
};

function messageFor(err: unknown, verb: string, roles: string): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Your session expired — please sign in again.";
    if (err.status === 403) return `Only ${roles} can ${verb}.`;
    const detail = detailOf(err.message);
    if (detail && DETAILS[detail]) return DETAILS[detail];
    return `Couldn't ${verb} (HTTP ${err.status}). Try again.`;
  }
  return `Couldn't ${verb}. Try again.`;
}

function detailOf(raw: string): string | null {
  try {
    const body = JSON.parse(raw) as { detail?: unknown };
    return typeof body.detail === "string" ? body.detail : null;
  } catch {
    return null;
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
