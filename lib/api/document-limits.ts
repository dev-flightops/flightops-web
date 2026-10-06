/**
 * Limits read from company documents (#47, M4-A-3).
 *
 *   POST /documents/{id}/text            read out a version's text, once
 *   POST /ai/document-limits             start a reading (202, runs on)
 *   GET  /ai/document-limits/{id}        one reading and its proposals
 *   GET  /ai/document-limits?document_id= a document's latest reading
 *
 * A reading proposes; it never changes a FRAT. Each proposal carries the
 * page and the sentence it came from, checked against the page by the
 * service, and waits for a Chief Pilot, DO or Exec Admin (#48).
 */

import { apiFetch } from "./client";

export type LimitKey =
  | "crosswind_single_engine_kt"
  | "crosswind_multi_engine_kt"
  | "crosswind_near_margin_kt"
  | "vfr_min_ceiling_ft"
  | "vfr_min_visibility_sm";

export interface LimitProposal {
  id: string;
  limit_key: LimitKey | string;
  label: string;
  /** A decimal, as the service sends it ("30.00"). */
  value: string;
  unit: "kt" | "ft" | "sm" | string;
  applies_to: string | null;
  page_number: number;
  quote: string;
  status: "pending" | "approved" | "rejected" | "superseded";
  created_at: string;
}

export interface LimitReading {
  id: string;
  document_id: string;
  document_title: string;
  version_number: number;
  status: "running" | "done" | "failed";
  model: string | null;
  pages_read: number | null;
  proposals_found: number | null;
  proposals_dropped: number | null;
  /** Why a failed reading failed, as a slug ("anthropic_timeout"). */
  error: string | null;
  requested_by_name: string | null;
  started_at: string;
  finished_at: string | null;
  proposals: LimitProposal[];
}

export interface DocumentTextStatus {
  document_id: string;
  version_number: number;
  text_status: "extracted" | "no_text" | "unsupported" | "failed" | null;
  page_count: number | null;
}

export async function readDocumentText(documentId: string): Promise<DocumentTextStatus> {
  return apiFetch<DocumentTextStatus>(`/documents/${documentId}/text`, { method: "POST" });
}

export async function startLimitReading(documentId: string): Promise<LimitReading> {
  return apiFetch<LimitReading>("/ai/document-limits", {
    method: "POST",
    body: JSON.stringify({ document_id: documentId }),
  });
}

export async function getLimitReading(readingId: string): Promise<LimitReading> {
  return apiFetch<LimitReading>(`/ai/document-limits/${readingId}`);
}

export async function getLatestLimitReading(
  documentId: string,
): Promise<LimitReading | null> {
  const qs = new URLSearchParams({ document_id: documentId });
  const body = await apiFetch<{ extraction: LimitReading | null }>(
    `/ai/document-limits?${qs.toString()}`,
  );
  return body.extraction;
}
