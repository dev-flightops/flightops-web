"use server";

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { auth } from "@/auth";

/**
 * Safety report submission — expanded stub until safety-service ships in M3.
 *
 * The formal spec mandates a global Safety Report button that:
 *   1. Stores the report in a safety_reports table
 *   2. Strips user_id when "anonymous" is checked (keeps role for stats)
 *   3. Notifies the safety officer
 *
 * Until safety-service exists the action validates the payload and
 * appends a JSONL record to `.safety-reports.log` at the project root so
 * filings survive a refresh (legacy parity hint: the safety officer can
 * `tail` the file in dev). The file write is best-effort — on a
 * read-only filesystem (Vercel preview / prod) we fall through to a
 * console-log so the route never 500s.
 *
 * When safety-service lands, swap the file append + console for an
 * apiFetch POST to `/safety/reports` and the modal UI stays unchanged.
 */

export const REPORT_TYPES = [
  "safety_concern",
  "hazard",
  "near_miss",
  "asap",
  "incident",
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

// Standard Part 5 SMS 5-step likelihood scale. The score 1..5 maps to a
// risk matrix coordinate when safety-service computes the assessment.
export const LIKELIHOODS = [
  "rare",
  "unlikely",
  "possible",
  "likely",
  "almost_certain",
] as const;
export type Likelihood = (typeof LIKELIHOODS)[number];

export type FileSafetyReportInput = {
  title: string;
  description: string;
  report_type: ReportType;
  severity: Severity;
  likelihood: Likelihood | null;
  location: string | null;
  flight_number: string | null;
  aircraft_tail: string | null;
  occurred_on: string | null; // yyyy-mm-dd, optional — defaults to today on save
  anonymous: boolean;
};

export type FileSafetyReportResult =
  | { status: "ok"; report_id: string }
  | { status: "error"; message: string };

const SAFETY_LOG_FILE = path.join(
  process.cwd(),
  ".safety-reports.log",
);

function _trimOrNull(value: string | null | undefined, max: number): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) return trimmed.slice(0, max);
  return trimmed;
}

function _todayIsoDate(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

export async function fileSafetyReportAction(
  input: FileSafetyReportInput,
): Promise<FileSafetyReportResult> {
  // ---- Validation -------------------------------------------------------

  const title = _trimOrNull(input.title, 200);
  if (!title || title.length < 4) {
    return {
      status: "error",
      message: "Title must be at least 4 characters.",
    };
  }
  const description = _trimOrNull(input.description, 5000);
  if (!description || description.length < 10) {
    return {
      status: "error",
      message: "Please describe the issue in at least 10 characters.",
    };
  }
  if (!REPORT_TYPES.includes(input.report_type)) {
    return { status: "error", message: "Invalid report type." };
  }
  if (!SEVERITIES.includes(input.severity)) {
    return { status: "error", message: "Invalid severity." };
  }
  if (input.likelihood !== null && !LIKELIHOODS.includes(input.likelihood)) {
    return { status: "error", message: "Invalid likelihood." };
  }
  if (
    input.occurred_on &&
    !/^\d{4}-\d{2}-\d{2}$/.test(input.occurred_on)
  ) {
    return { status: "error", message: "Occurrence date must be yyyy-mm-dd." };
  }

  // ---- Identity ---------------------------------------------------------
  // Anonymous reports strip user_id + name; role is preserved so the
  // safety officer can still slice by role without identifying the
  // filer. tenant_id is always retained — the report belongs to a tenant
  // even when anonymous.

  const session = await auth();
  const tenant_id = session?.tenant_id ?? null;
  const user_id = input.anonymous ? null : (session?.user?.id ?? null);
  const user_name = input.anonymous ? null : (session?.user?.name ?? null);
  const roles = (session?.roles ?? []) as string[];

  // ---- Persist ----------------------------------------------------------

  const record = {
    report_id: randomUUID(),
    created_at: new Date().toISOString(),
    tenant_id,
    user_id,
    user_name,
    roles,
    anonymous: input.anonymous,
    title,
    description,
    report_type: input.report_type,
    severity: input.severity,
    likelihood: input.likelihood,
    location: _trimOrNull(input.location, 200),
    flight_number: _trimOrNull(input.flight_number, 40),
    aircraft_tail: _trimOrNull(input.aircraft_tail, 20),
    occurred_on: input.occurred_on || _todayIsoDate(),
  };

  try {
    await fs.appendFile(SAFETY_LOG_FILE, JSON.stringify(record) + "\n", "utf8");
  } catch {
    // Read-only FS (Vercel) or permission issue — fall through to console.
  }
  // Always print a one-line summary so on-call has a record even when
  // file persistence is unavailable.
  console.log(
    "[safety-report]",
    JSON.stringify({
      report_id: record.report_id,
      tenant_id,
      anonymous: input.anonymous,
      report_type: record.report_type,
      severity: record.severity,
      likelihood: record.likelihood,
      title_len: title.length,
      description_len: description.length,
    }),
  );

  return { status: "ok", report_id: record.report_id };
}
