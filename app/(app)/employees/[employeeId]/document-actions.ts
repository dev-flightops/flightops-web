"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { uploadEmployeeDocument } from "@/lib/api/employee-documents";

export interface UploadResult {
  ok: boolean;
  error?: string;
}

/**
 * File a document against a requirement.
 *
 * Directly callable rather than a `useActionState` form action: that
 * hook is React 19 and this app is on 18.3.1, so a component using it
 * is stubbed out under jsdom and its logic goes untested.
 *
 * The FormData is forwarded as multipart rather than rebuilt, so the
 * file is never copied through a JSON body.
 */
export async function uploadEmployeeDocumentAction(
  employeeId: string,
  form: FormData,
): Promise<UploadResult> {
  const requirementId = String(form.get("requirement_id") ?? "").trim();
  if (!requirementId) {
    return { ok: false, error: "Pick which requirement this satisfies." };
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a file to upload." };
  }

  const outbound = new FormData();
  outbound.append("requirement_id", requirementId);
  outbound.append("file", file, file.name);
  for (const field of ["issued_on", "expires_on", "notes"] as const) {
    const value = String(form.get(field) ?? "").trim();
    // Empty stays out of the body entirely. The service reads a blank
    // date as "not set", but sending nothing is unambiguous.
    if (value) outbound.append(field, value);
  }

  try {
    await uploadEmployeeDocument(employeeId, outbound);
  } catch (err) {
    return { ok: false, error: mapUploadError(err) };
  }
  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/employees");
  return { ok: true };
}

/**
 * The service's refusals are specific and worth passing through —
 * "'Medical Certificate' needs an expiry date" names the requirement
 * and a reader can act on it. A generic "upload failed" throws that
 * away.
 *
 * `ApiError.message` is the raw response text, which for FastAPI is
 * `{"detail": "..."}`. It is PARSED rather than shown: rendering that
 * JSON is how /customers/{id} ends up putting
 * `{"detail":"insufficient_role"}` on screen.
 */
function mapUploadError(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return "Couldn't upload. Try again in a moment.";
  }
  if (err.status === 403) {
    return "You need Exec Admin to file a document against an employee.";
  }
  if (err.status === 413) {
    return "That file is too large — the limit is 25 MB.";
  }
  if (err.status === 415) {
    return "That file type isn't accepted. Use a PDF, an image, or a Word document.";
  }
  const detail = detailOf(err.message);
  if (detail) return detail;
  return err.status === 409
    ? "That requirement is no longer in use."
    : err.status === 422
      ? "Something on the form was not valid."
      : "Couldn't upload. Try again in a moment.";
}

/** Pull FastAPI's `detail` string out of a raw error body, or null. */
function detailOf(raw: string): string | null {
  try {
    const detail = (JSON.parse(raw) as { detail?: unknown }).detail;
    return typeof detail === "string" && detail.trim() ? detail : null;
  } catch {
    return null;
  }
}
