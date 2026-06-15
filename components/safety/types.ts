/**
 * Safety report catalog constants + types.
 *
 * These live in their own module because `actions.ts` is a `"use server"`
 * file and Next.js forbids non-async exports there. Both the server
 * action and the modal component import from here.
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
