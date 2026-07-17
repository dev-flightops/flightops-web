"use client";

import { useActionState } from "react";

import { type NotesFormState, updateNotesAction } from "./actions";

const _initial: NotesFormState = { status: "idle" };

/**
 * Progress-log for a CAPA. Owner edits, everyone else sees read-only.
 * Closed CAPAs render as a plain block with no textarea.
 */
export function NotesForm({
  capaId,
  notes,
  canEdit,
}: {
  capaId: string;
  notes: string;
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateNotesAction,
    _initial,
  );

  if (!canEdit) {
    return (
      <section className="mb-6 rounded-lg border border-border bg-card p-5">
        <h2 className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Progress notes
        </h2>
        {notes ? (
          <p className="whitespace-pre-wrap text-sm text-foreground/90">
            {notes}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Owner has not logged progress yet.
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-lg border border-border bg-card p-5">
      <h2 className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Progress notes
      </h2>

      {state.status === "error" && state.message ? (
        <div
          role="alert"
          className="mb-3 rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
        >
          {state.message}
        </div>
      ) : null}
      {state.status === "ok" ? (
        <div
          role="status"
          className="mb-3 rounded-md border border-status-green/40 bg-status-green/10 px-3 py-2 text-xs text-status-green"
        >
          Saved.
        </div>
      ) : null}

      <form action={formAction}>
        <input type="hidden" name="capa_id" value={capaId} />
        <textarea
          name="notes"
          defaultValue={notes}
          rows={6}
          maxLength={8000}
          placeholder="Log progress here — Safety Officer sees this on the board."
          className="ff-notes"
        />
        <div className="mt-3 flex items-center justify-end">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-status-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save notes"}
          </button>
        </div>
      </form>

      <style>{`
        .ff-notes {
          width: 100%;
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          border: 1px solid hsl(var(--border));
          border-radius: 8px;
          padding: 0.5rem 0.75rem;
          font-size: 0.8125rem;
          outline: none;
          resize: vertical;
          font-family: inherit;
        }
        .ff-notes:focus:not(:disabled) {
          border-color: hsl(var(--primary));
          box-shadow: 0 0 0 3px hsl(var(--primary) / 0.12);
        }
      `}</style>
    </section>
  );
}
