"use client";

import { useActionState } from "react";

import {
  HAZARD_CATEGORIES,
  HAZARD_CATEGORY_LABELS,
  HAZARD_SEVERITIES,
  HAZARD_SEVERITY_LABELS,
} from "@/lib/api/safety";
import type { StationListItem } from "@/lib/api/types";

import { submitHazardAction, type ReportFormState } from "./actions";

const _initialState: ReportFormState = { status: "idle" };

export function ReportForm({ stations }: { stations: StationListItem[] }) {
  const [state, formAction, pending] = useActionState(
    submitHazardAction,
    _initialState,
  );

  return (
    <form action={formAction} className="space-y-6">
      {state.status === "error" && state.message ? (
        <div
          role="alert"
          className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
        >
          {state.message}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Category" name="category" error={state.fieldErrors?.category}>
          <select
            id="category"
            name="category"
            required
            className="ff-input"
            defaultValue=""
          >
            <option value="" disabled>
              Select…
            </option>
            {HAZARD_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {HAZARD_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Severity" name="severity" error={state.fieldErrors?.severity}>
          <select
            id="severity"
            name="severity"
            required
            className="ff-input"
            defaultValue="medium"
          >
            {HAZARD_SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {HAZARD_SEVERITY_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        label="Description"
        name="description"
        error={state.fieldErrors?.description}
        hint="What did you observe? Include enough detail for the Safety Officer to act."
      >
        <textarea
          id="description"
          name="description"
          rows={5}
          required
          minLength={10}
          maxLength={4000}
          className="ff-input"
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Station"
          name="station_id"
          hint="Optional — leave blank for off-airport hazards."
        >
          <select
            id="station_id"
            name="station_id"
            className="ff-input"
            defaultValue=""
          >
            <option value="">— None —</option>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.icao_code} — {s.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Location (free text)"
          name="location_free_text"
          hint="Only if no station applies."
        >
          <input
            id="location_free_text"
            name="location_free_text"
            type="text"
            maxLength={200}
            className="ff-input"
            autoComplete="off"
          />
        </Field>
      </div>

      <Field
        label="Immediate action taken"
        name="immediate_action_taken"
        hint="Optional — what did you do at the time?"
      >
        <textarea
          id="immediate_action_taken"
          name="immediate_action_taken"
          rows={3}
          maxLength={4000}
          className="ff-input"
        />
      </Field>

      <label className="flex items-start gap-2 rounded-md border border-border bg-card/40 px-3 py-2.5">
        <input
          type="checkbox"
          name="is_anonymous"
          className="mt-0.5"
        />
        <span className="text-xs text-foreground/80">
          <span className="font-semibold">Hide my name from the triage inbox.</span>{" "}
          Your identity is still recorded for audit but is only visible to
          the Safety Officer.
        </span>
      </label>

      <div className="flex items-center justify-end gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-status-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
        >
          {pending ? "Filing…" : "File Hazard"}
        </button>
      </div>

      <style>{`
        .ff-input {
          width: 100%;
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          border: 1px solid hsl(var(--border));
          border-radius: 8px;
          padding: 0.5rem 0.75rem;
          font-size: 0.8125rem;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .ff-input:focus:not(:disabled) {
          border-color: hsl(var(--primary));
          box-shadow: 0 0 0 3px hsl(var(--primary) / 0.12);
        }
        textarea.ff-input { resize: vertical; font-family: inherit; }
      `}</style>
    </form>
  );
}

function Field({
  label,
  name,
  hint,
  error,
  children,
}: {
  label: string;
  name: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={name}
        className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
      >
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p className="mt-1 text-[0.6875rem] text-muted-foreground/80">{hint}</p>
      ) : null}
      {error ? (
        <p className="mt-1 text-[0.6875rem] text-status-red">{error}</p>
      ) : null}
    </div>
  );
}
