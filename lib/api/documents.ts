/**
 * Typed wrapper for the documents-service endpoints on the ops gateway.
 * Router is mounted at /documents (see infra/nginx/dev.conf).
 */

import { apiFetch } from "./client";

export interface DocumentVersion {
  id: string;
  version_number: number;
  file_key: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  notes: string | null;
  uploaded_by_user_id: string;
  uploaded_by_name: string | null;
  uploaded_at: string;
}

export interface DocumentRow {
  id: string;
  title: string;
  slug: string;
  category: string;
  description: string | null;
  is_archived: boolean;
  requires_acknowledgment: boolean;
  current_version_id: string | null;
  current_version_number: number;
  created_by_user_id: string;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface MyAcknowledgmentStatus {
  document_id: string;
  current_version_id: string | null;
  current_version_number: number;
  requires_acknowledgment: boolean;
  acknowledged: boolean;
  acknowledged_at: string | null;
  acknowledged_version_number: number | null;
}

export interface RequiredReadingRow {
  document: DocumentRow;
  status: MyAcknowledgmentStatus;
}

export interface RequiredReadingResponse {
  items: RequiredReadingRow[];
  pending: number;
  total: number;
}

export interface DocumentAcknowledgmentRow {
  id: string;
  document_id: string;
  document_version_id: string;
  document_version_number: number;
  user_id: string;
  user_full_name: string | null;
  user_email: string | null;
  acknowledged_at: string;
  notes: string | null;
}

export interface DocumentAcknowledgmentListResponse {
  items: DocumentAcknowledgmentRow[];
  total: number;
}

export interface DocumentListResponse {
  items: DocumentRow[];
  categories: string[];
}

export interface DocumentDetailResponse {
  document: DocumentRow;
  versions: DocumentVersion[];
}

export interface DocumentCreatePayload {
  title: string;
  category?: string;
  description?: string | null;
  requires_acknowledgment?: boolean;
}

export interface DocumentUpdatePayload {
  title?: string;
  category?: string;
  description?: string | null;
  requires_acknowledgment?: boolean;
}

export interface ListDocumentsParams {
  category?: string;
  includeArchived?: boolean;
}

export async function listDocuments(
  params: ListDocumentsParams = {},
): Promise<DocumentListResponse> {
  const qs = new URLSearchParams();
  if (params.category) qs.set("category", params.category);
  if (params.includeArchived) qs.set("include_archived", "true");
  const tail = qs.toString() ? `?${qs.toString()}` : "";
  // Trailing slash required — the nginx gateway's `location /documents/`
  // block only matches paths that begin with `/documents/`; a bare
  // `/documents` falls through to the default handler and 301s.
  return apiFetch<DocumentListResponse>(`/documents/${tail}`);
}

export async function getDocument(
  documentId: string,
): Promise<DocumentDetailResponse> {
  return apiFetch<DocumentDetailResponse>(`/documents/${documentId}`);
}

export async function createDocument(
  payload: DocumentCreatePayload,
): Promise<DocumentRow> {
  return apiFetch<DocumentRow>("/documents/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateDocument(
  documentId: string,
  patch: DocumentUpdatePayload,
): Promise<DocumentRow> {
  return apiFetch<DocumentRow>(`/documents/${documentId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

/** Upload a new version to an existing document. Backend accepts
 *  multipart/form-data with `file` (required) + `notes` (optional).
 *  Caller assembles the FormData so we can accept either a File
 *  (browser) or a Blob-like value (server actions). */
export async function uploadDocumentVersion(
  documentId: string,
  form: FormData,
): Promise<DocumentVersion> {
  return apiFetch<DocumentVersion>(`/documents/${documentId}/versions`, {
    method: "POST",
    body: form,
  });
}

export async function archiveDocument(documentId: string): Promise<void> {
  await apiFetch<void>(`/documents/${documentId}`, { method: "DELETE" });
}

/** URL an <a href> can hit for the current-version download.
 *  Points at the same-origin Next.js /api route which server-side
 *  attaches the Bearer token and streams the file — see
 *  app/api/documents/[documentId]/download/route.ts. Anchors can't
 *  set headers themselves, so this indirection is required. */
export function downloadUrl(documentId: string): string {
  return `/api/documents/${documentId}/download`;
}

export function versionDownloadUrl(
  documentId: string,
  versionNumber: number,
): string {
  return `/api/documents/${documentId}/versions/${versionNumber}/download`;
}

/** Required-reading feed for the calling user — every doc flagged
 *  requires_acknowledgment=true across the tenant, paired with the
 *  caller's current ack status. Backend: GET /documents/my-required-reading. */
export async function myRequiredReading(): Promise<RequiredReadingResponse> {
  return apiFetch<RequiredReadingResponse>("/documents/my-required-reading");
}

/** Caller's ack status for a single document. Returns the same
 *  MyAcknowledgmentStatus shape used by the required-reading feed.
 *  Backend: GET /documents/{id}/acknowledgments/mine. */
export async function myAcknowledgment(
  documentId: string,
): Promise<MyAcknowledgmentStatus> {
  return apiFetch<MyAcknowledgmentStatus>(
    `/documents/${documentId}/acknowledgments/mine`,
  );
}

/** Ack the CURRENT version of a document for the calling user.
 *  Idempotent — repeat calls return the existing row instead of
 *  producing a duplicate. Backend: POST /documents/{id}/acknowledgments. */
export async function acknowledgeDocument(
  documentId: string,
  notes?: string,
): Promise<DocumentAcknowledgmentRow> {
  return apiFetch<DocumentAcknowledgmentRow>(
    `/documents/${documentId}/acknowledgments`,
    {
      method: "POST",
      body: JSON.stringify({ notes: notes ?? null }),
    },
  );
}

/** Admin roster of every ack on the document (including on prior
 *  versions). Backend gates on exec_admin role; regular callers 403.
 *  Backend: GET /documents/{id}/acknowledgments. */
export async function listAcknowledgments(
  documentId: string,
): Promise<DocumentAcknowledgmentListResponse> {
  return apiFetch<DocumentAcknowledgmentListResponse>(
    `/documents/${documentId}/acknowledgments`,
  );
}
