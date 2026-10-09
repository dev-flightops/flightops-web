import { DirectUploadError, putToStorage } from "@/lib/direct-upload";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/upload-limits";

import { completeLargeUploadAction, startLargeUploadAction } from "./actions";

/** A file the web host can't carry, so it goes straight to storage (#17). */
export function needsDirectUpload(file: File | null): file is File {
  return !!file && file.size > MAX_UPLOAD_BYTES;
}

/**
 * Add `file` as the document's new version by way of the bucket: a URL
 * from the service, the PUT from here, then the service adds what
 * arrived. Resolves to an error message, or null when it worked.
 */
export async function uploadLargeVersion(
  documentId: string,
  file: File,
  notes: string | null,
  onProgress: (fraction: number) => void,
): Promise<string | null> {
  const start = await startLargeUploadAction(documentId, {
    filename: file.name,
    contentType: file.type,
    size: file.size,
  });
  if (!start.ok || !start.data) return start.error ?? "Couldn't start the upload.";
  try {
    await putToStorage(start.data.url, start.data.headers, file, onProgress);
  } catch (err) {
    return err instanceof DirectUploadError ? err.message : "The file couldn't be sent to storage.";
  }
  const done = await completeLargeUploadAction(documentId, {
    fileKey: start.data.file_key,
    filename: file.name,
    notes,
  });
  return done.ok ? null : (done.error ?? "Couldn't add the uploaded file.");
}

/** "50 MB": the library's limit when files can go straight to storage. */
export function maxUploadLabel(limits: { max_bytes: number }): string {
  return `${Math.round(limits.max_bytes / (1024 * 1024))} MB`;
}

/** Why a file over 3.8 MB can't be uploaded here, or null when it can
 *  go straight to storage. */
export function largeFileRefusal(
  file: File,
  limits: { direct_uploads: boolean; max_bytes: number } | null,
): string | null {
  if (!limits?.direct_uploads) {
    return `${file.name} is too large: files over ${MAX_UPLOAD_LABEL} can't be uploaded on this server.`;
  }
  if (file.size > limits.max_bytes) {
    return `${file.name} is too large: the library takes files up to ${maxUploadLabel(limits)}.`;
  }
  return null;
}
