"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";

import { DOCUMENT_CATEGORIES } from "./filter-bar";
import type { ActionResult } from "./actions";
import { createDocumentAction } from "./actions";

/**
 * Slide-over drawer for creating a new document. Handles the metadata
 * + optional first-version upload in a single submit — the server
 * action creates the document, then chains a POST to /versions if a
 * file was attached. On success, routes to the new document's
 * detail page.
 */
export function UploadDocumentDrawer({
  variant = "primary",
}: {
  variant?: "primary" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<
    ActionResult<{ id: string }>,
    FormData
  >(createDocumentAction, { ok: false });
  const router = useRouter();

  if (state.ok && state.data && open) {
    setOpen(false);
    router.push(`/documents/${state.data.id}`);
  }

  const buttonClass =
    variant === "primary"
      ? "rounded-md bg-status-blue px-3 py-2 text-xs font-semibold text-white hover:brightness-110"
      : "rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground/80 hover:bg-muted/20";
  const label = variant === "primary" ? "+ Upload Document" : "Upload Document";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClass}
      >
        {label}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Upload document"
          className="fixed inset-0 z-40 flex items-start justify-end bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="h-full w-full max-w-md overflow-y-auto border-l border-border bg-card p-5 shadow-xl">
            <header className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">Upload Document</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Metadata + first version in one step. Additional revisions
                  land under the document's version history.
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

            <form action={action} className="space-y-3">
              <Field label="Title" required>
                <input
                  name="title"
                  type="text"
                  required
                  placeholder="General Operations Manual"
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-status-blue focus:outline-none"
                />
              </Field>

              <Field label="Category">
                <select name="category" defaultValue="General" className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-status-blue focus:outline-none">
                  <option value="General">General</option>
                  {DOCUMENT_CATEGORIES.filter((c) => c.value).map((c) => (
                    <option key={c.value} value={c.label}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Description">
                <textarea
                  name="description"
                  rows={3}
                  placeholder="Short summary — what does this cover?"
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-status-blue focus:outline-none"
                />
              </Field>

              <Field label="File">
                <input
                  name="file"
                  type="file"
                  className="block w-full text-xs text-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-2 file:py-1 file:text-xs file:font-semibold file:text-foreground/80 hover:file:bg-muted/20"
                />
                <p className="mt-1 text-[0.65rem] text-muted-foreground">
                  Max 50 MB. PDF, DOCX, XLSX supported.
                </p>
              </Field>

              <Field label="Upload notes (optional)">
                <input
                  name="upload_notes"
                  type="text"
                  placeholder="e.g. Rev 3.1 — Bethel base added"
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-status-blue focus:outline-none"
                />
              </Field>

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
                  {pending ? "Uploading…" : "Upload document"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
        {required && <span className="ml-1 text-status-red">*</span>}
      </span>
      {children}
    </label>
  );
}
