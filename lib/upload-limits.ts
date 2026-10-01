/**
 * The largest file an upload form can send.
 *
 * Uploads go through a server action, so the whole multipart body passes
 * through a Vercel function: 4.5 MB at most, 4 MB through proxy.ts, and
 * next.config's serverActions.bodySizeLimit. The body also carries the
 * other form fields and multipart framing, and Vercel does not say whether
 * its "4 MB" is decimal, so files are held to 3.8 MB.
 *
 * Anything bigger is refused in the browser with a clear message. Sent
 * anyway, it would hit the platform's 413 before the action runs, and the
 * page would show the error boundary instead of the form's own error.
 * Larger files (a 50 MB manual) need uploads that go straight to storage,
 * which are not built yet.
 */
export const MAX_UPLOAD_BYTES = 3_800_000;
export const MAX_UPLOAD_LABEL = "3.8 MB";

/** Rounded up, so a file just over the limit never reads as "3.8 MB". */
function megabytes(bytes: number): string {
  return `${(Math.ceil(bytes / 100_000) / 10).toFixed(1)} MB`;
}

/** Why a file can't be uploaded, or null when it fits. */
export function oversizeMessage(file: File): string | null {
  if (file.size <= MAX_UPLOAD_BYTES) return null;
  return `${file.name} is ${megabytes(file.size)}. Files over ${MAX_UPLOAD_LABEL} can't be uploaded yet.`;
}

/** The first oversize file among a form's file inputs, as a message. */
export function formOversizeMessage(form: HTMLFormElement): string | null {
  for (const element of Array.from(form.elements)) {
    if (!(element instanceof HTMLInputElement) || element.type !== "file") continue;
    for (const file of Array.from(element.files ?? [])) {
      const message = oversizeMessage(file);
      if (message) return message;
    }
  }
  return null;
}
