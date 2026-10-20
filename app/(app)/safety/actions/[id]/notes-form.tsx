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
        <h2 className="mb-3 eyebrow">
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
      <h2 className="mb-3 eyebrow">
        Progress notes
      </h2>

      {state.status === "error" && state.message ? (
        <div
          role="alert"
          className="mb-3 notice notice-red"
        >
          {state.message}
        </div>
      ) : null}
      {state.status === "ok" ? (
        <div
          role="status"
          className="mb-3 notice notice-green"
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
          className="ff-input"
        />
        <div className="mt-3 flex items-center justify-end">
          <button
            type="submit"
            disabled={pending}
            className="btn-caps rounded-md bg-primary px-4 py-2 text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save notes"}
          </button>
        </div>
      </form>

    </section>
  );
}
