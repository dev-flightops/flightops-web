"use client";

import { useActionState, useState } from "react";

import type { IncidentStatus } from "@/lib/api/safety";

import { triageIncidentAction, type IncidentTriageState } from "./actions";

const _initial: IncidentTriageState = { status: "idle" };

const NEXT_STATUS_OPTIONS: Record<IncidentStatus, IncidentStatus[]> = {
  submitted: ["triaged", "closed"],
  triaged: ["in_progress", "closed"],
  in_progress: ["closed"],
  closed: [],
};

const STATUS_ACTION_LABELS: Record<IncidentStatus, string> = {
  submitted: "Back to Submitted",
  triaged: "Mark Triaged",
  in_progress: "Move to In Progress",
  closed: "Close incident",
};

export function IncidentTriageControls({
  incidentId,
  currentStatus,
}: {
  incidentId: string;
  currentStatus: IncidentStatus;
}) {
  const [state, formAction, pending] = useActionState(
    triageIncidentAction,
    _initial,
  );
  const options = NEXT_STATUS_OPTIONS[currentStatus];
  const [nextStatus, setNextStatus] = useState<IncidentStatus>(
    options[0] ?? currentStatus,
  );
  if (options.length === 0) return null;

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Triage
      </h2>

      {state.status === "error" && state.message ? (
        <div
          role="alert"
          className="mb-3 rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
        >
          {state.message}
        </div>
      ) : null}

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="incident_id" value={incidentId} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="min-w-0">
            <span className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Move to
            </span>
            <select
              name="next_status"
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value as IncidentStatus)}
              className="ff-input-inline"
            >
              {options.map((o) => (
                <option key={o} value={o}>
                  {STATUS_ACTION_LABELS[o]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {nextStatus === "closed" ? (
          <label className="block">
            <span className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Closure reason (required)
            </span>
            <textarea
              name="closed_reason"
              rows={3}
              required
              maxLength={4000}
              className="ff-input-inline"
              placeholder="Root cause + corrective actions taken, if any."
            />
          </label>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-status-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Apply"}
          </button>
        </div>
      </form>

      <style>{`
        .ff-input-inline {
          width: 100%;
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          border: 1px solid hsl(var(--border));
          border-radius: 8px;
          padding: 0.5rem 0.75rem;
          font-size: 0.8125rem;
          outline: none;
        }
        .ff-input-inline:focus:not(:disabled) {
          border-color: hsl(var(--primary));
          box-shadow: 0 0 0 3px hsl(var(--primary) / 0.12);
        }
        textarea.ff-input-inline { resize: vertical; font-family: inherit; }
      `}</style>
    </section>
  );
}
