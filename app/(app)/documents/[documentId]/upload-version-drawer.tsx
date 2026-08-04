"use client";

import { useActionState, useState } from "react";

import type { ActionResult } from "../actions";
import { uploadVersionAction } from "../actions";

/**
 * Slide-over drawer for uploading a new version to an existing
 * document. Distinct from the "+ Upload Document" drawer on the list
 * page — this one keeps the document metadata untouched and just
 * appends a version row.
 */
export function UploadVersionDrawer({ documentId }: { documentId: string }) {
  const [open, setOpen] = useState(false);
  const action = uploadVersionAction.bind(null, documentId);
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(
    action,
    { ok: false },
  );

  if (state.ok && open) setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-status-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110"
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
                className="rounded p-1 text-muted-foreground hover:bg-muted/20"
              >
                ✕
              </button>
            </header>

            <form action={formAction} className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  File <span className="ml-1 text-status-red">*</span>
                </span>
                <input
                  name="file"
                  type="file"
                  required
                  className="block w-full text-xs text-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-2 file:py-1 file:text-xs file:font-semibold file:text-foreground/80 hover:file:bg-muted/20"
                />
                <p className="mt-1 text-[0.65rem] text-muted-foreground">
                  Max 50 MB.
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
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-status-blue focus:outline-none"
                />
              </label>

              {state.error && (
                <p role="alert" className="text-xs text-status-red">
                  {state.error}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-muted/20"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-status-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
                >
                  {pending ? "Uploading…" : "Upload version"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
