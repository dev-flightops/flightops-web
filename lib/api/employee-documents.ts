/**
 * Typed wrapper for the employee-documents endpoints.
 *
 * Mounted at /employee-documents on the gateway — its own nginx
 * location, because that prefix does not fall under /documents/.
 *
 * Distinct from `lib/api/documents.ts`, which is the COMPANY library:
 * the GOM, bulletins, the FAR/AIM. That is one document many people
 * read; this is many documents about one person.
 */

import type { DocumentState } from "@/lib/employee-documents/states";

import { apiFetch } from "./client";

// The state vocabulary lives in `lib/employee-documents/states.ts`,
// not here: this module reaches `apiFetch`, which begins with
// `await auth()`, so a component that imported a label from here could
// not render under vitest. Re-exported for callers already reaching
// for the API module.
export {
  DOCUMENT_STATES,
  DOCUMENT_STATE_LABELS,
  DOCUMENT_STATE_TOKENS,
  NEEDS_ACTION,
  isDocumentState,
  type DocumentState,
} from "@/lib/employee-documents/states";

export interface DocumentRequirementRow {
  id: string;
  name: string;
  description: string | null;
  /** Empty means every role. */
  applies_to_roles: string[];
  required_on_hire: boolean;
  has_expiry: boolean;
  reminder_days: number;
  sort_order: number;
  is_active: boolean;
}

export interface UploadedDocumentRow {
  id: string;
  requirement_id: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  issued_on: string | null;
  expires_on: string | null;
  notes: string | null;
  uploaded_by_user_id: string;
  created_at: string;
}

export interface ChecklistItem {
  requirement: DocumentRequirementRow;
  state: DocumentState | string;
  /** Signed days to expiry; negative once past, null when undated. */
  days_to_expiry: number | null;
  current: UploadedDocumentRow | null;
  /** Older uploads, newest first — the renewal history. */
  superseded: UploadedDocumentRow[];
}

export interface ChecklistResponse {
  employee_id: string;
  employee_name: string | null;
  /** The date the states were computed against, so a reader is never
   *  guessing which "today" an "expiring" badge refers to. */
  as_of: string;
  items: ChecklistItem[];
  outstanding: number;
}

export interface RequirementListResponse {
  items: DocumentRequirementRow[];
}

export interface RequirementCreatePayload {
  name: string;
  description?: string | null;
  applies_to_roles?: string[];
  required_on_hire?: boolean;
  has_expiry?: boolean;
  reminder_days?: number;
  sort_order?: number;
}

export type RequirementUpdatePayload = Partial<RequirementCreatePayload> & {
  is_active?: boolean;
};

export interface ExpiringRow {
  employee_id: string;
  employee_name: string | null;
  requirement_id: string;
  requirement_name: string;
  state: DocumentState | string;
  expires_on: string | null;
  days_to_expiry: number | null;
}

export interface ExpiringResponse {
  as_of: string;
  within_days: number;
  items: ExpiringRow[];
}

// ---- Calls ----------------------------------------------------------------

export async function listDocumentRequirements(
  params: { includeInactive?: boolean } = {},
): Promise<RequirementListResponse> {
  const qs = params.includeInactive ? "?include_inactive=true" : "";
  return apiFetch<RequirementListResponse>(
    `/employee-documents/requirements${qs}`,
  );
}

export async function createDocumentRequirement(
  payload: RequirementCreatePayload,
): Promise<DocumentRequirementRow> {
  return apiFetch<DocumentRequirementRow>("/employee-documents/requirements", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateDocumentRequirement(
  requirementId: string,
  patch: RequirementUpdatePayload,
): Promise<DocumentRequirementRow> {
  return apiFetch<DocumentRequirementRow>(
    `/employee-documents/requirements/${requirementId}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
}

export async function deactivateDocumentRequirement(
  requirementId: string,
): Promise<void> {
  await apiFetch<void>(`/employee-documents/requirements/${requirementId}`, {
    method: "DELETE",
  });
}

export async function getEmployeeChecklist(
  employeeId: string,
): Promise<ChecklistResponse> {
  return apiFetch<ChecklistResponse>(
    `/employee-documents/employees/${employeeId}`,
  );
}

/** Multipart. The caller builds the FormData so the file never has to
 *  be copied through a JSON body. */
export async function uploadEmployeeDocument(
  employeeId: string,
  form: FormData,
): Promise<UploadedDocumentRow> {
  return apiFetch<UploadedDocumentRow>(
    `/employee-documents/employees/${employeeId}`,
    { method: "POST", body: form },
  );
}

export async function listExpiringDocuments(
  withinDays = 60,
): Promise<ExpiringResponse> {
  return apiFetch<ExpiringResponse>(
    `/employee-documents/expiring?within_days=${withinDays}`,
  );
}
