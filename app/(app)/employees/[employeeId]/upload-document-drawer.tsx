"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import type { DocumentRequirementRow } from "@/lib/api/employee-documents";

import { uploadEmployeeDocumentAction } from "./document-actions";

/**
 * File a document against a requirement.
 *
 * The expiry field is required when the chosen requirement says so,
 * and the form says which — the service refuses a missing expiry, and
 * finding that out after picking a file is a worse way to learn it.
 * The service is still the authority; this is so the common case does
 * not need a round trip.
 */
export function UploadDocumentDrawer({
  employeeId,
  requirements,
}: {
  employeeId: string;
  requirements: DocumentRequirementRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [requirementId, setRequirementId] = useState(
    requirements[0]?.id ?? "",
  );
  const formRef = useRef<HTMLFormElement>(null);

  const chosen = requirements.find((r) => r.id === requirementId);
  const expiryRequired = Boolean(chosen?.has_expiry);

  function onSubmit(form: HTMLFormElement) {
    setError(null);
    const data = new FormData(form);
    start(async () => {
      const result = await uploadEmployeeDocumentAction(employeeId, data);
      if (!result.ok) {
        setError(result.error ?? "Couldn't upload.");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="rounded-md bg-status-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110"
      >
        + Upload
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
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold">Upload document</h2>
                <p className="mt-0.5 text-[0.7rem] text-muted-foreground">
                  Filing against a requirement that already has a
                  document keeps the old one as history.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form
              ref={formRef}
              onSubmit={(e) => {
                e.preventDefault();
                onSubmit(e.currentTarget);
              }}
              className="space-y-3"
            >
              <Field label="Requirement" required>
                <select
                  name="requirement_id"
                  value={requirementId}
                  onChange={(e) => setRequirementId(e.target.value)}
                  required
                  className={INPUT}
                >
                  {requirements.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="File" required>
                <input
                  name="file"
                  type="file"
                  required
                  accept=".pdf,.jpg,.jpeg,.png,.heic,.tif,.tiff,.doc,.docx"
                  className="block w-full text-xs text-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-2 file:py-1 file:text-xs file:font-semibold file:text-foreground/80 hover:file:bg-muted/20"
                />
                <span className="mt-1 block text-[0.65rem] text-muted-foreground">
                  Max 25 MB. PDF, image or Word document.
                </span>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Issued on">
                  <input name="issued_on" type="date" className={INPUT} />
                </Field>
                <Field label="Expires on" required={expiryRequired}>
                  <input
                    name="expires_on"
                    type="date"
                    required={expiryRequired}
                    className={INPUT}
                  />
                  {expiryRequired && (
                    <span className="mt-1 block text-[0.65rem] text-status-yellow">
                      {/* Said before the file is chosen, not after the
                          server refuses it. */}
                      &ldquo;{chosen?.name}&rdquo; is checked against its
                      expiry, so this is required.
                    </span>
                  )}
                </Field>
              </div>

              <Field label="Notes">
                <textarea name="notes" rows={2} className={INPUT} />
              </Field>

              {error && (
                <p role="alert" className="text-xs text-status-red">
                  {error}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-status-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50"
                >
                  {pending ? "Uploading…" : "Upload"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-muted/20"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

const INPUT =
  "w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-status-blue focus:outline-none";

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
        {required && <span className="text-status-red"> *</span>}
      </span>
      {children}
    </label>
  );
}
