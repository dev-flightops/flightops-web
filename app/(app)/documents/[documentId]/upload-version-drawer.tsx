"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";

import type { UploadLimits } from "@/lib/api/documents";
import { formOversizeMessage, MAX_UPLOAD_LABEL } from "@/lib/upload-limits";

import type { ActionResult } from "../actions";
import { uploadVersionAction } from "../actions";
import { largeFileRefusal, maxUploadLabel, needsDirectUpload, uploadLargeVersion } from "../large-upload";
import { UploadProgress } from "../upload-progress";

/**
 * Slide-over drawer for uploading a new version to an existing
 * document. Distinct from the "+ Upload Document" drawer on the list
 * page — this one keeps the document metadata untouched and just
 * appends a version row.
 *
 * A file over 3.8 MB goes straight to storage when the server has a
 * bucket (#17): it is too big for the server action. `limits` says
 * whether it does; without them the 3.8 MB cap stands.
 */
export function UploadVersionDrawer({
  documentId,
  limits = null,
}: {
  documentId: string;
  limits?: UploadLimits | null;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const action = uploadVersionAction.bind(null, documentId);
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(
    action,
    { ok: false },
  );

  const [sizeError, setSizeError] = useState<string | null>(null);

  if (state.ok && open) setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          // A refusal from the last attempt is not about the next one.
          setSizeError(null);
          setOpen(true);
        }}
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark"
      >
        + Upload New Version
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Upload new version"
          className="fixed inset-0 z-40 flex items-start justify-end bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="h-full w-full max-w-md overflow-y-auto border-l border-border bg-card p-5 shadow-xl">
            <header className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">Upload New Version</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Adds a version row. The current-version pointer flips to
                  this file after upload; older versions stay downloadable.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded p-1 text-muted-foreground hover:bg-accent"
              >
                ✕
              </button>
            </header>

            <form
              action={formAction}
              onSubmit={(e) => {
                const form = e.currentTarget;
                const file = (form.elements.namedItem("file") as HTMLInputElement | null)?.files?.[0] ?? null;
                if (!needsDirectUpload(file)) {
                  setSizeError(formOversizeMessage(form));
                  return;
                }
                e.preventDefault();
                const refusal = largeFileRefusal(file, limits);
                setSizeError(refusal);
                if (refusal) return;
                const notes = String(new FormData(form).get("notes") ?? "").trim() || null;
                setProgress(0);
                void uploadLargeVersion(documentId, file, notes, setProgress).then((error) => {
                  setProgress(null);
                  if (error) {
                    setSizeError(error);
                    return;
                  }
                  setOpen(false);
                  router.refresh();
                });
              }}
              className="space-y-3"
            >
              <label className="block">
                <span className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  File <span className="ml-1 text-status-red">*</span>
                </span>
                <input
                  name="file"
                  type="file"
                  required
                  className="block w-full text-xs text-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-2 file:py-1 file:text-xs file:font-semibold file:text-foreground/80 hover:file:bg-accent"
                />
                <p className="mt-1 text-[0.65rem] text-muted-foreground">
                  Max {limits?.direct_uploads ? maxUploadLabel(limits) : MAX_UPLOAD_LABEL}.
                </p>
              </label>

              <label className="block">
                <span className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Change notes (optional)
                </span>
                <input
                  name="notes"
                  type="text"
                  placeholder="e.g. Rev 3.2 — updated MEL section"
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </label>

              {progress !== null ? <UploadProgress fraction={progress} /> : null}

              {(sizeError ?? state.error) && (
                <p role="alert" className="text-xs text-status-red">
                  {sizeError ?? state.error}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending || progress !== null}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
                >
                  {pending || progress !== null ? "Uploading…" : "Upload version"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
