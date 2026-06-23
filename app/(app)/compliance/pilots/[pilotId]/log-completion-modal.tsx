"use client";

import { useActionState, useEffect } from "react";

import { Spinner } from "@/components/ui/spinner";
import type { CurrencyItemRef } from "@/lib/api/types";

import {
  logCompletionAction,
  type LogCompletionState,
} from "./log-completion-action";

/**
 * Log Completion modal — Spec 5 §"Log Completion modal".
 *
 * Fields:
 *   - Training item       (pre-filled, locked)
 *   - Pilot               (pre-filled, locked)
 *   - Completion date     (required, defaults to today, no future)
 *   - Completed by        (required free-text)
 *   - Examiner cert       (required for check events with examiner)
 *   - Pass / Fail         (required for check events only)
 *   - Score               (optional)
 *   - Notes               (optional)
 *   - Document upload     (deferred — needs an R2 / blob endpoint)
 *
 * The modal is intentionally simple — no portal, no escape-key
 * listener, no focus-trap. Spec 5 doesn't call them out and the
 * legacy dialog is similarly bare; we'll layer those in once the
 * full a11y pass lands (M2-G-18).
 */
export function LogCompletionModal({
  pilotId,
  pilotName,
  item,
  onClose,
}: {
  pilotId: string;
  pilotName: string;
  item: CurrencyItemRef;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<
    LogCompletionState,
    FormData
  >(logCompletionAction, { status: "idle" });

  useEffect(() => {
    if (state.status === "success") {
      // Let the user see the green flash briefly, then close.
      const id = setTimeout(onClose, 900);
      return () => clearTimeout(id);
    }
  }, [state.status, onClose]);

  const fieldError = (key: string): string | undefined =>
    state.status === "field-errors" ? state.errors[key] : undefined;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="log-completion-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2
              id="log-completion-title"
              className="text-sm font-bold tracking-tight"
            >
              Log Completion
            </h2>
            <p className="mt-0.5 text-[0.7rem] text-muted-foreground">
              {item.name} · {pilotName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-xl leading-none text-muted-foreground hover:text-foreground"
          >
            &times;
          </button>
        </div>

        <form action={action} className="space-y-3">
          <input type="hidden" name="pilot_user_id" value={pilotId} />
          <input type="hidden" name="currency_item_id" value={item.id} />

          <Field
            name="completion_date"
            label="Completion Date"
            type="date"
            defaultValue={today}
            max={today}
            required
            error={fieldError("completion_date")}
          />

          <Field
            name="completed_by"
            label="Completed By / Instructor"
            type="text"
            placeholder="Examiner Jane Doe"
            required
            error={fieldError("completed_by")}
          />

          {item.requires_examiner && (
            <Field
              name="examiner_cert_number"
              label="Examiner Certificate #"
              type="text"
              placeholder="FAA cert #"
              required
              error={fieldError("examiner_cert_number")}
            />
          )}

          {item.is_check_event && (
            <FieldSelect
              name="result"
              label="Pass / Fail"
              required
              error={fieldError("result")}
            >
              <option value="">Select…</option>
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
            </FieldSelect>
          )}

          <Field
            name="score"
            label="Score (optional)"
            type="number"
            step="0.1"
            error={fieldError("score")}
          />

          <FieldTextarea
            name="notes"
            label="Notes (optional)"
            rows={2}
            error={fieldError("notes")}
          />

          {state.status === "api-error" && (
            <div
              role="alert"
              className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
            >
              {state.message}
            </div>
          )}
          {state.status === "success" && (
            <div
              role="status"
              className="rounded-md border border-status-green/40 bg-status-green/10 px-3 py-2 text-xs text-status-green"
            >
              Saved — status updated.
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={pending || state.status === "success"}
              className="inline-flex items-center gap-1.5 rounded-md bg-status-blue px-4 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50"
            >
              {pending && <Spinner size="xs" />}
              {pending ? "Saving…" : "Save Completion"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border bg-card px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  error,
  ...inputProps
}: React.InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  label: string;
  error?: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        aria-invalid={error ? "true" : undefined}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-status-blue focus:outline-none aria-[invalid=true]:border-status-red"
        {...inputProps}
      />
      {error && (
        <p role="alert" className="mt-1 text-[0.65rem] text-status-red">
          {error}
        </p>
      )}
    </div>
  );
}

function FieldSelect({
  name,
  label,
  error,
  required,
  children,
}: {
  name: string;
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
      >
        {label}
      </label>
      <select
        id={name}
        name={name}
        required={required}
        aria-invalid={error ? "true" : undefined}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-status-blue focus:outline-none aria-[invalid=true]:border-status-red"
      >
        {children}
      </select>
      {error && (
        <p role="alert" className="mt-1 text-[0.65rem] text-status-red">
          {error}
        </p>
      )}
    </div>
  );
}

function FieldTextarea({
  name,
  label,
  error,
  rows = 3,
}: {
  name: string;
  label: string;
  error?: string;
  rows?: number;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
      >
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={rows}
        aria-invalid={error ? "true" : undefined}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-status-blue focus:outline-none aria-[invalid=true]:border-status-red"
      />
      {error && (
        <p role="alert" className="mt-1 text-[0.65rem] text-status-red">
          {error}
        </p>
      )}
    </div>
  );
}
