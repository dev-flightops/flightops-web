/**
 * Safety reports (#58): what the red Safety button files.
 *
 * Legacy keeps these apart from hazards and so does safety-service: a
 * report is what someone saw, a hazard is what the safety team
 * registers from it. Endpoints under `/safety/reports`; see
 * services/safety/app/routes/safety_reports.py for who may call which.
 *
 * Risk is legacy's 5x5 matrix, severity x likelihood, banded 15+ high
 * and 8+ medium. The service computes it; `riskOf` here is only for a
 * form previewing a score before it is saved.
 */

import { apiFetch } from "./client";
import type { UserRef } from "./safety";

/** Legacy's report types, in its order. */
export const SAFETY_REPORT_TYPES = [
  "safety_concern",
  "near_miss",
  "asap",
  "observation",
  "suggestion",
  "non_compliance",
  "fatigue",
  "other",
] as const;
export type SafetyReportType = (typeof SAFETY_REPORT_TYPES)[number];

export const SAFETY_REPORT_TYPE_LABELS: Record<SafetyReportType, string> = {
  safety_concern: "Safety Concern",
  near_miss: "Near Miss",
  asap: "ASAP Report",
  observation: "Observation",
  suggestion: "Safety Suggestion",
  non_compliance: "Non-Compliance",
  fatigue: "Fatigue Report",
  other: "Other",
};

export const SAFETY_REPORT_STATUSES = [
  "open",
  "under_review",
  "in_progress",
  "closed",
] as const;
export type SafetyReportStatus = (typeof SAFETY_REPORT_STATUSES)[number];

export const SAFETY_REPORT_STATUS_LABELS: Record<SafetyReportStatus, string> = {
  open: "Open",
  under_review: "Under Review",
  in_progress: "In Progress",
  closed: "Closed",
};

/** 1-5, legacy's labels. */
export const SEVERITY_LABELS: Record<number, string> = {
  1: "Negligible",
  2: "Minor",
  3: "Major",
  4: "Hazardous",
  5: "Catastrophic",
};

export const LIKELIHOOD_LABELS: Record<number, string> = {
  1: "Improbable",
  2: "Remote",
  3: "Occasional",
  4: "Probable",
  5: "Frequent",
};

export const RISK_SCALE = [1, 2, 3, 4, 5] as const;

export type RiskLevel = "low" | "medium" | "high";

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  low: "Low Risk",
  medium: "Medium Risk",
  high: "High Risk",
};

/** The service's banding, for previewing a score in a form. */
export function riskOf(
  severity: number | null | undefined,
  likelihood: number | null | undefined,
): { score: number; level: RiskLevel } | null {
  if (!severity || !likelihood) return null;
  const score = severity * likelihood;
  return { score, level: score >= 15 ? "high" : score >= 8 ? "medium" : "low" };
}

export interface SafetyReport {
  id: string;
  report_type: SafetyReportType;
  title: string;
  description: string;
  location: string | null;
  flight_number: string | null;
  aircraft_tail: string | null;
  /** YYYY-MM-DD: the day it happened. */
  occurred_on: string;
  is_anonymous: boolean;
  /** Null on an anonymous report unless the caller may see who filed it
   *  (the Safety Officer, an Exec Admin, or the filer). */
  reporter: UserRef | null;
  reporter_department: string | null;
  severity: number | null;
  likelihood: number | null;
  risk_score: number | null;
  risk_level: RiskLevel | null;
  status: SafetyReportStatus;
  assigned_to: UserRef | null;
  resolution: string | null;
  reviewed_at: string | null;
  reviewed_by: UserRef | null;
  closed_at: string | null;
  closed_by: UserRef | null;
  attachment: { filename: string; content_type: string } | null;
  created_at: string;
  updated_at: string;
}

export interface SafetyReportList {
  items: SafetyReport[];
  total: number;
}

export interface SafetyReportFiling {
  report_type: SafetyReportType;
  title: string;
  description: string;
  location?: string | null;
  flight_number?: string | null;
  aircraft_tail?: string | null;
  occurred_on?: string | null;
  is_anonymous: boolean;
  reporter_department?: string | null;
  severity?: number | null;
  likelihood?: number | null;
}

/** Only the fields sent change; an explicit null clears one. */
export interface SafetyReportReview {
  status?: SafetyReportStatus;
  assigned_to_user_id?: string | null;
  resolution?: string | null;
  severity?: number | null;
  likelihood?: number | null;
}

export interface SafetyReportReviewer {
  id: string;
  full_name: string;
  /** May be assigned an ASAP report. */
  sees_asap: boolean;
}

export interface SafetyReportSummary {
  open: number;
  open_high_risk: number;
  this_year: number;
  /** The last six months, oldest first, by the day each happened. */
  by_month: { month: string; count: number }[];
}

/** File one: the fields as JSON in `payload`, and the photo or PDF if
 *  there is one, as one multipart request. */
export async function fileSafetyReport(
  filing: SafetyReportFiling,
  attachment: File | null,
): Promise<SafetyReport> {
  const form = new FormData();
  form.set("payload", JSON.stringify(filing));
  if (attachment && attachment.size > 0) form.set("attachment", attachment);
  return apiFetch<SafetyReport>("/safety/reports", { method: "POST", body: form });
}

export async function listSafetyReports(
  params: { status?: SafetyReportStatus; type?: SafetyReportType; limit?: number; offset?: number } = {},
): Promise<SafetyReportList> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.type) search.set("type", params.type);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.offset !== undefined) search.set("offset", String(params.offset));
  const qs = search.toString();
  return apiFetch<SafetyReportList>(`/safety/reports${qs ? `?${qs}` : ""}`);
}

export async function listMySafetyReports(limit = 100): Promise<SafetyReportList> {
  return apiFetch<SafetyReportList>(`/safety/reports/mine?limit=${limit}`);
}

export async function getSafetyReport(id: string): Promise<SafetyReport> {
  return apiFetch<SafetyReport>(`/safety/reports/${encodeURIComponent(id)}`);
}

export async function reviewSafetyReport(
  id: string,
  review: SafetyReportReview,
): Promise<SafetyReport> {
  return apiFetch<SafetyReport>(`/safety/reports/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(review),
  });
}

export async function getSafetyReportSummary(): Promise<SafetyReportSummary> {
  return apiFetch<SafetyReportSummary>("/safety/reports/summary");
}

export async function listSafetyReportReviewers(): Promise<SafetyReportReviewer[]> {
  return apiFetch<SafetyReportReviewer[]>("/safety/reports/reviewers");
}

/** Where the browser opens an attachment: the app's own route, which
 *  adds the session's token the service needs. */
export function safetyReportAttachmentHref(id: string): string {
  return `/api/safety-reports/${encodeURIComponent(id)}/attachment`;
}
