"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import {
  SAFETY_REPORT_TYPES,
  type SafetyReportFiling,
  fileSafetyReport,
} from "@/lib/api/safety-reports";
import { safeReturnPath } from "@/lib/safety/return-path";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/upload-limits";

const optional = (max: number) => z.string().trim().max(max).optional();
const scale = z
  .string()
  .regex(/^[1-5]?$/)
  .optional();

const _schema = z.object({
  report_type: z.enum(SAFETY_REPORT_TYPES),
  title: z.string().trim().min(1, "Give the report a title.").max(300),
  description: z
    .string()
    .trim()
    .min(1, "Describe what happened.")
    .max(10000, "Keep the description under 10,000 characters."),
  location: optional(200),
  flight_number: optional(50),
  aircraft_tail: optional(20),
  occurred_on: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, "Pick the date it happened.")
    .optional(),
  is_anonymous: z.string().optional(),
  reporter_department: optional(100),
  severity: scale,
  likelihood: scale,
});

/** The text fields, sent back on a failed filing so the form can show
 *  them again: React clears a form once its action completes. */
const ECHOED = [
  "report_type",
  "title",
  "description",
  "location",
  "flight_number",
  "aircraft_tail",
  "occurred_on",
  "is_anonymous",
  "reporter_department",
  "severity",
  "likelihood",
] as const;

export interface FileReportState {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
  /** Bumped on every failed filing; the form remounts on it. */
  attempt: number;
}

export async function fileSafetyReportAction(
  prev: FileReportState,
  formData: FormData,
): Promise<FileReportState> {
  const values: Record<string, string> = {};
  for (const key of ECHOED) values[key] = String(formData.get(key) ?? "");
  const attachment = formData.get("attachment");
  const file = attachment instanceof File && attachment.size > 0 ? attachment : null;
  const attempt = prev.attempt + 1;
  // A file input cannot be refilled, so say so whenever one was picked.
  const reattach = file ? " Pick the attachment again." : "";
  const fail = (message: string, fieldErrors?: Record<string, string>): FileReportState => ({
    status: "error",
    message: message + reattach,
    fieldErrors,
    values,
    attempt,
  });

  const parsed = _schema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return fail("Please fix the highlighted fields.", fieldErrors);
  }
  if (file && file.size > MAX_UPLOAD_BYTES) {
    return fail(`Attachments over ${MAX_UPLOAD_LABEL} can't be uploaded yet.`);
  }

  const v = parsed.data;
  const anonymous = v.is_anonymous === "on";
  const filing: SafetyReportFiling = {
    report_type: v.report_type,
    title: v.title,
    description: v.description,
    location: v.location || null,
    flight_number: v.flight_number || null,
    aircraft_tail: v.aircraft_tail || null,
    occurred_on: v.occurred_on || null,
    is_anonymous: anonymous,
    reporter_department: anonymous ? null : v.reporter_department || null,
    severity: v.severity ? Number(v.severity) : null,
    likelihood: v.likelihood ? Number(v.likelihood) : null,
  };

  let id: string;
  try {
    id = (await fileSafetyReport(filing, file)).id;
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) return fail("Your session expired. Sign in again to file this report.");
      if (err.status === 413) return fail(`Attachments over ${MAX_UPLOAD_LABEL} can't be uploaded yet.`);
      if (err.status === 422 && err.message.includes("asap_reports_are_not_anonymous")) {
        return fail("An ASAP report can't be anonymous: the Event Review Committee has to be able to reach you.");
      }
      if (err.status === 415) {
        return fail(
          "Attach a photo (JPG, PNG, GIF or WEBP) or a PDF. An iPhone HEIC photo has to be exported as JPEG first.",
        );
      }
      return fail(`The report was not filed (HTTP ${err.status}). Try again.`);
    }
    return fail("Could not reach the safety service. Try again in a moment.");
  }

  const back = safeReturnPath(String(formData.get("return_url") ?? ""));
  redirect(`/safety/reports/${id}?filed=1${back ? `&return_url=${encodeURIComponent(back)}` : ""}`);
}
