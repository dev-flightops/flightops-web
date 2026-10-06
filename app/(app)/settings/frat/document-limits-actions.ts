"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import {
  approveDocumentLimit,
  getLimitReading,
  readDocumentText,
  rejectDocumentLimit,
  startLimitReading,
  type LimitReading,
} from "@/lib/api/document-limits";

/**
 * Reading a company document for the FRAT's limits (#47).
 *
 * Called directly from the client section rather than as form actions:
 * the unit tests run React 18, which has neither useActionState nor
 * function form actions. A reading runs on in the ai service, so the
 * section starts one here and then asks after it with getReadingAction.
 */

export type ReadingResult =
  | { ok: true; reading: LimitReading }
  | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TEXT_PROBLEMS: Record<string, string> = {
  no_text:
    "This file has no text to read — a scan, perhaps. Upload a PDF with selectable text.",
  unsupported: "Only a PDF or a text file can be read for limits.",
  failed: "The file couldn't be read. Upload it again as a PDF.",
};

const REFUSALS: Record<string, string> = {
  anthropic_not_configured: "Reading documents isn't set up on this deployment.",
  not_a_compliance_source:
    "That document isn't marked as a compliance source. Mark it in the Document Library first.",
  document_has_no_file: "That document has no file uploaded yet.",
  document_not_found: "That document is no longer in the library. Refresh the page.",
  file_not_found: "The document's file is missing. Upload it again.",
};

export async function readDocumentLimitsAction(documentId: string): Promise<ReadingResult> {
  if (!UUID.test(documentId)) return { ok: false, error: "Pick a document." };
  try {
    const text = await readDocumentText(documentId);
    if (text.text_status !== "extracted") {
      return {
        ok: false,
        error: TEXT_PROBLEMS[text.text_status ?? "failed"] ?? TEXT_PROBLEMS.failed,
      };
    }
    return { ok: true, reading: await startLimitReading(documentId) };
  } catch (err) {
    return { ok: false, error: messageFor(err, "read the document") };
  }
}

export async function getReadingAction(readingId: string): Promise<ReadingResult> {
  if (!UUID.test(readingId)) return { ok: false, error: "Refresh the page." };
  try {
    return { ok: true, reading: await getLimitReading(readingId) };
  } catch (err) {
    return { ok: false, error: messageFor(err, "check on the reading") };
  }
}

// ---- Deciding on a proposal (#48) ----------------------------------------------

export type DecisionResult = { ok: true } | { ok: false; error: string };

const DECIDED = "Someone has already decided on this one. Refresh the page.";
const DECISION_REFUSALS: Record<string, string> = {
  proposal_approved: DECIDED,
  proposal_rejected: DECIDED,
  proposal_superseded: "A newer reading or approval has replaced this one. Refresh the page.",
  proposal_not_found: "That proposal is gone. Refresh the page.",
  value_out_of_range: "That value is outside what the setting allows.",
  value_not_whole: "This setting takes a whole number.",
  value_not_a_number: "Enter the value as a number.",
};

/** Set the FRAT limit from a proposal, as read or with `value` instead. */
export async function approveLimitAction(
  proposalId: string,
  value?: string,
): Promise<DecisionResult> {
  if (!UUID.test(proposalId)) return { ok: false, error: "Refresh the page." };
  const corrected = value?.trim() || null;
  if (corrected !== null && !/^\d+(\.\d+)?$/.test(corrected)) {
    return { ok: false, error: "Enter the value as a number." };
  }
  try {
    await approveDocumentLimit(proposalId, { value: corrected });
  } catch (err) {
    return { ok: false, error: decisionMessage(err, "approve it") };
  }
  revalidatePath("/settings/frat");
  return { ok: true };
}

export async function rejectLimitAction(proposalId: string): Promise<DecisionResult> {
  if (!UUID.test(proposalId)) return { ok: false, error: "Refresh the page." };
  try {
    await rejectDocumentLimit(proposalId);
  } catch (err) {
    return { ok: false, error: decisionMessage(err, "reject it") };
  }
  revalidatePath("/settings/frat");
  return { ok: true };
}

function decisionMessage(err: unknown, verb: string): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Your session expired — please sign in again.";
    if (err.status === 403) {
      return "Only a Chief Pilot, Director of Operations or Exec Admin can approve or reject a limit.";
    }
    const detail = detailOf(err.message);
    if (detail && DECISION_REFUSALS[detail]) return DECISION_REFUSALS[detail];
    // The policy check answers in a sentence that names the numbers.
    if (err.status === 422 && detail && detail.includes(" ")) return detail;
    return `Couldn't ${verb} (HTTP ${err.status}). Try again.`;
  }
  return `Couldn't ${verb}. Try again.`;
}

function messageFor(err: unknown, verb: string): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Your session expired — please sign in again.";
    if (err.status === 403) {
      return "Only a Chief Pilot, Director of Operations or Exec Admin can read documents for limits.";
    }
    const detail = detailOf(err.message);
    if (detail && REFUSALS[detail]) return REFUSALS[detail];
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
