"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import {
  type UploadTarget,
  acknowledgeDocument,
  archiveDocument,
  completeVersionUpload,
  createDocument,
  getVersionUploadUrl,
  updateDocument,
  uploadDocumentVersion,
} from "@/lib/api/documents";

export interface ActionResult<T = void> {
  ok: boolean;
  error?: string;
  data?: T;
}

/** Create a new document (title + category + optional description).
 *  The upload happens as a follow-up POST to /versions — this action
 *  returns the created document's id so the caller can chain the
 *  upload immediately. */
export async function createDocumentAction(
  _prev: ActionResult<{ id: string }>,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "General").trim();
  const description = strOrNull(formData.get("description"));
  if (!title) return { ok: false, error: "Title is required." };

  try {
    const doc = await createDocument({
      title,
      category: category || "General",
      description,
      // An unchecked checkbox is absent from FormData entirely, so
      // this reads as false rather than undefined.
      is_compliance_source: formData.get("is_compliance_source") === "true",
    });
    // Optional inline upload: if the drawer also passed a `file`,
    // POST the first version so the document lands with content
    // rather than as a metadata-only stub.
    const file = formData.get("file");
    if (file instanceof File && file.size > 0) {
      const upload = new FormData();
      upload.append("file", file, file.name);
      const notes = strOrNull(formData.get("upload_notes"));
      if (notes) upload.append("notes", notes);
      await uploadDocumentVersion(doc.id, upload);
    }
    revalidatePath("/documents");
    return { ok: true, data: { id: doc.id } };
  } catch (err) {
    return { ok: false, error: mapError(err, "Couldn't create document.") };
  }
}

/** Upload a new version to an existing document. Powers the version
 *  drawer on /documents/[id]. */
export async function uploadVersionAction(
  documentId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Pick a file to upload." };
  }
  try {
    const upload = new FormData();
    upload.append("file", file, file.name);
    const notes = strOrNull(formData.get("notes"));
    if (notes) upload.append("notes", notes);
    await uploadDocumentVersion(documentId, upload);
    revalidatePath(`/documents/${documentId}`);
    revalidatePath("/documents");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err, "Couldn't upload version.") };
  }
}

/**
 * Large uploads (#17): the file goes from the browser straight to the
 * bucket, past the web host's 4.5 MB cap. These two actions are the
 * ends of it: a URL to PUT to, then adding what was sent as the new
 * version. The bytes never pass through here.
 */
export async function startLargeUploadAction(
  documentId: string,
  file: { filename: string; contentType: string; size: number },
): Promise<ActionResult<UploadTarget>> {
  try {
    const target = await getVersionUploadUrl(documentId, {
      filename: file.filename,
      content_type: file.contentType || "application/octet-stream",
      size_bytes: file.size,
    });
    return { ok: true, data: target };
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      return { ok: false, error: "Files this large can't be uploaded on this server." };
    }
    return { ok: false, error: mapError(err, "Couldn't start the upload.") };
  }
}

export async function completeLargeUploadAction(
  documentId: string,
  upload: { fileKey: string; filename: string; notes: string | null },
): Promise<ActionResult> {
  try {
    await completeVersionUpload(documentId, {
      file_key: upload.fileKey,
      filename: upload.filename,
      notes: upload.notes,
    });
    revalidatePath(`/documents/${documentId}`);
    revalidatePath("/documents");
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return { ok: false, error: "The file didn't reach storage. Upload it again." };
    }
    if (err instanceof ApiError && err.message.includes("upload_already_added")) {
      return { ok: false, error: "That file has already been added as a version." };
    }
    return { ok: false, error: mapError(err, "Couldn't add the uploaded file.") };
  }
}

export async function updateDocumentAction(
  documentId: string,
  patch: {
    title?: string;
    category?: string;
    description?: string | null;
    is_compliance_source?: boolean;
  },
): Promise<ActionResult> {
  try {
    await updateDocument(documentId, patch);
    revalidatePath("/documents");
    revalidatePath(`/documents/${documentId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err, "Couldn't update document.") };
  }
}

/** Mark the CURRENT version of a document as read for the caller.
 *  Wraps POST /documents/{id}/acknowledgments — idempotent, so
 *  double-submits from a slow network are harmless. Revalidates the
 *  required-reading feed + doc detail so the ack shows up on the
 *  next render without a hard refresh. */
export async function acknowledgeDocumentAction(
  documentId: string,
  notes?: string,
): Promise<ActionResult> {
  try {
    await acknowledgeDocument(documentId, notes);
    revalidatePath("/documents/ack");
    revalidatePath(`/documents/${documentId}`);
    revalidatePath("/documents");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err, "Couldn't record acknowledgment.") };
  }
}

/** Soft-archive a document. Backend flips is_archived; the list
 *  filter hides archived rows by default. */
export async function archiveDocumentAction(
  documentId: string,
): Promise<ActionResult> {
  try {
    await archiveDocument(documentId);
    revalidatePath("/documents");
    revalidatePath(`/documents/${documentId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: mapError(err, "Couldn't archive document.") };
  }
}

// ---- helpers ---------------------------------------------------------------

function strOrNull(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s === "" ? null : s;
}

function mapError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Your session expired — sign in again.";
    if (err.status === 403)
      return "You don't have permission to make this change.";
    if (err.status === 413)
      return "File too large — the upload cap is 50 MB.";
    if (err.status >= 400 && err.status < 500) {
      try {
        const detail = JSON.parse(err.message)?.detail;
        if (typeof detail === "string") return detail;
      } catch {
        // fall through
      }
    }
  }
  return fallback;
}
