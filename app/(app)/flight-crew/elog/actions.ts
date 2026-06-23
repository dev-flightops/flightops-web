"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import { createFlightLog, submitFlightLog } from "@/lib/api/ops";

/**
 * Server actions behind the Spec 4 §"Flight Log" UI:
 *   createFlightLogAction — "Start Flight Log" form on the landing
 *   submitFlightLogAction — Submit Log button on the 7-tab page
 *
 * apiFetch is server-only, so the client form + Submit button bounce
 * through these wrappers. Errors are mapped to friendly inline
 * messages where the backend's `detail` string is meaningful; opaque
 * fallbacks otherwise.
 *
 * Redirect after create lands on /flight-crew/elog/{id} — the 7-tab
 * scaffold. Tab 1 (Flight Info) renders today; Tabs 2/3/5/6/7 ship
 * in follow-up PRs.
 */

const Schema = z.object({
  aircraft_id: z.string().uuid("Pick an aircraft"),
  flight_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  flight_number: z
    .string()
    .trim()
    .max(12, "Max 12 characters")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  flight_type: z.enum([
    "advisory",
    "charter",
    "training",
    "ferry",
    "other",
  ]),
});

export type CreateFlightLogState =
  | { status: "idle" }
  | { status: "field-errors"; errors: Record<string, string> }
  | { status: "api-error"; message: string };

export async function createFlightLogAction(
  _prev: CreateFlightLogState,
  formData: FormData,
): Promise<CreateFlightLogState> {
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

  let logId: string;
  try {
    const log = await createFlightLog({
      aircraft_id: parsed.data.aircraft_id,
      flight_id: parsed.data.flight_id ?? null,
      flight_number: parsed.data.flight_number ?? null,
      flight_type: parsed.data.flight_type,
    });
    logId = log.id;
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        return {
          status: "api-error",
          message: "Your session expired — please sign in again.",
        };
      }
      const detail = parseDetail(err.message);
      if (detail === "aircraft_not_active") {
        return {
          status: "api-error",
          message:
            "The selected aircraft is inactive. Reactivate it under Maintenance, then retry.",
        };
      }
      if (detail === "aircraft_not_found") {
        return {
          status: "api-error",
          message: "That aircraft is no longer in your fleet.",
        };
      }
      if (detail === "flight_aircraft_mismatch") {
        return {
          status: "field-errors",
          errors: {
            flight_id:
              "Pick a flight that belongs to the selected aircraft, or leave it blank.",
          },
        };
      }
      if (detail === "flight_not_found") {
        return {
          status: "field-errors",
          errors: { flight_id: "That flight no longer exists." },
        };
      }
      return {
        status: "api-error",
        message: `Couldn't start the log (HTTP ${err.status}). Try again in a moment.`,
      };
    }
    return {
      status: "api-error",
      message: "Couldn't start the log. Try again in a moment.",
    };
  }

  redirect(`/flight-crew/elog/${logId}`);
}

export type SubmitFlightLogState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "submitted" };

/**
 * Flip a draft log to submitted. Wrapper around the apiFetch server
 * call so the Tab-7 Submit button (a client component) can invoke it.
 *
 * On success we return `{status: "submitted"}` so the page can
 * re-render the badge + lock the form rather than redirect — the
 * pilot's still on the same log, just in a read-only state now.
 *
 * `already_submitted` is treated as success-equivalent for UX
 * purposes: if a double-click slipped through the disabled button,
 * the user shouldn't see a scary error for what they intended.
 */
export async function submitFlightLogAction(
  _prev: SubmitFlightLogState,
  formData: FormData,
): Promise<SubmitFlightLogState> {
  const logId = formData.get("log_id");
  if (typeof logId !== "string" || logId === "") {
    return { status: "error", message: "Missing log id." };
  }
  try {
    await submitFlightLog(logId);
    return { status: "submitted" };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        return {
          status: "error",
          message: "Your session expired — please sign in again.",
        };
      }
      const detail = parseDetail(err.message);
      if (detail === "flight_log_already_submitted") {
        return { status: "submitted" };
      }
      if (detail === "flight_log_not_found") {
        return {
          status: "error",
          message: "This log no longer exists.",
        };
      }
      return {
        status: "error",
        message: `Couldn't submit the log (HTTP ${err.status}). Try again in a moment.`,
      };
    }
    return {
      status: "error",
      message: "Couldn't submit the log. Try again in a moment.",
    };
  }
}

function parseDetail(message: string): string {
  try {
    const parsed = JSON.parse(message) as { detail?: unknown };
    return typeof parsed.detail === "string" ? parsed.detail : "";
  } catch {
    return "";
  }
}
