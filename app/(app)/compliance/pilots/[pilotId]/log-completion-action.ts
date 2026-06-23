"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import { logCurrencyCompletion } from "@/lib/api/ops";

/**
 * Server action behind the Log Completion modal — Spec 5 §"What
 * happens when Save is clicked".
 *
 * apiFetch is server-only, so the dialog (a client component)
 * bounces through here. The action maps known backend `detail`
 * strings to friendly inline error messages; the rest fall through
 * to a generic message.
 *
 * On success, revalidates both the profile page and the board so
 * the new status shows up immediately in both views.
 */

const Schema = z
  .object({
    pilot_user_id: z.string().uuid(),
    currency_item_id: z.string().uuid(),
    completion_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
      message: "Pick a valid date",
    }),
    completed_by: z.string().trim().min(1, "Required").max(200),
    examiner_cert_number: z
      .string()
      .trim()
      .max(64)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    result: z
      .enum(["pass", "fail"])
      .optional()
      .or(z.literal("").transform(() => undefined)),
    score: z
      .string()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    notes: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  // Spec 5 §"Modal fields": "Cannot be a future date."
  .refine(
    (data) => data.completion_date <= todayIso(),
    {
      path: ["completion_date"],
      message: "Cannot be in the future",
    },
  );

export type LogCompletionState =
  | { status: "idle" }
  | { status: "field-errors"; errors: Record<string, string> }
  | { status: "api-error"; message: string }
  | { status: "success"; cell_status: string };

export async function logCompletionAction(
  _prev: LogCompletionState,
  formData: FormData,
): Promise<LogCompletionState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = Schema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_");
      if (!errors[key]) errors[key] = issue.message;
    }
    return { status: "field-errors", errors };
  }

  try {
    const scoreNum =
      parsed.data.score !== undefined && parsed.data.score !== ""
        ? Number(parsed.data.score)
        : null;
    if (scoreNum !== null && Number.isNaN(scoreNum)) {
      return {
        status: "field-errors",
        errors: { score: "Must be a number" },
      };
    }

    const result = await logCurrencyCompletion({
      pilot_user_id: parsed.data.pilot_user_id,
      currency_item_id: parsed.data.currency_item_id,
      completion_date: parsed.data.completion_date,
      completed_by: parsed.data.completed_by,
      examiner_cert_number: parsed.data.examiner_cert_number ?? null,
      result: parsed.data.result ?? null,
      score: scoreNum,
      notes: parsed.data.notes ?? null,
    });

    revalidatePath("/compliance/crew-currency");
    revalidatePath(`/compliance/pilots/${parsed.data.pilot_user_id}`);

    return { status: "success", cell_status: result.cell.status };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        return {
          status: "api-error",
          message: "Your session expired — please sign in again.",
        };
      }
      const detail = parseDetail(err.message);
      const fieldErrors = mapDetailToField(detail);
      if (fieldErrors) return { status: "field-errors", errors: fieldErrors };
      if (detail === "completion_date_in_future") {
        return {
          status: "field-errors",
          errors: { completion_date: "Cannot be in the future" },
        };
      }
      if (detail === "rolling_items_use_elog_auto_fire") {
        return {
          status: "api-error",
          message:
            "Rolling items (IFR / landings) update automatically from flight logs.",
        };
      }
      if (detail === "pilot_not_found") {
        return {
          status: "api-error",
          message: "That pilot is no longer on this tenant.",
        };
      }
      if (detail === "currency_item_not_found") {
        return {
          status: "api-error",
          message: "That currency item is no longer active.",
        };
      }
      return {
        status: "api-error",
        message: `Couldn't save (HTTP ${err.status}). Try again.`,
      };
    }
    return {
      status: "api-error",
      message: "Couldn't save. Try again in a moment.",
    };
  }
}

function mapDetailToField(detail: string): Record<string, string> | null {
  if (detail === "result_required_for_check_event") {
    return { result: "Pass / Fail is required for this item" };
  }
  if (detail === "result_not_allowed_for_non_check_event") {
    return { result: "Pass / Fail does not apply to this item" };
  }
  if (detail === "examiner_cert_required") {
    return { examiner_cert_number: "Examiner cert required for this item" };
  }
  return null;
}

function parseDetail(message: string): string {
  try {
    const parsed = JSON.parse(message) as { detail?: unknown };
    return typeof parsed.detail === "string" ? parsed.detail : "";
  } catch {
    return "";
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
