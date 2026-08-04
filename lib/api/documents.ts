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
  current_version_id: string | null;
  current_version_number: number;
  created_by_user_id: string;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
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
}

export interface DocumentUpdatePayload {
  title?: string;
  category?: string;
  description?: string | null;
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
