"use client";

import { useActionState, useState } from "react";

import { type CapaStatus } from "@/lib/api/safety";

import { type StatusFormState, updateStatusAction } from "./actions";

const _initial: StatusFormState = { status: "idle" };

const NEXT_STATUS_OPTIONS: Record<CapaStatus, CapaStatus[]> = {
  open: ["in_progress", "closed"],
  in_progress: ["closed"],
  closed: [],
};

const STATUS_ACTION_LABELS: Record<CapaStatus, string> = {
  open: "Back to Open",
  in_progress: "Move to In Progress",
  closed: "Close corrective action",
};

export function StatusControls({
  capaId,
  currentStatus,
}: {
  capaId: string;
  currentStatus: CapaStatus;
}) {
  const [state, formAction, pending] = useActionState(
    updateStatusAction,
    _initial,
  );
  const options = NEXT_STATUS_OPTIONS[currentStatus];
  const [nextStatus, setNextStatus] = useState<CapaStatus>(
    options[0] ?? currentStatus,
  );
  if (options.length === 0) return null;

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Status (Safety Officer only)
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
        <input type="hidden" name="capa_id" value={capaId} />
        <label className="min-w-0 block">
          <span className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Move to
          </span>
          <select
            name="next_status"
            value={nextStatus}
            onChange={(e) => setNextStatus(e.target.value as CapaStatus)}
            className="ff-status"
          >
            {options.map((o) => (
              <option key={o} value={o}>
                {STATUS_ACTION_LABELS[o]}
              </option>
            ))}
          </select>
        </label>

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
              className="ff-status"
              placeholder="What was done? Reference vendor / receipt / photo, if any."
            />
          </label>
        ) : null}

        <div className="flex items-center justify-end">
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
        .ff-status {
          width: 100%;
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          border: 1px solid hsl(var(--border));
          border-radius: 8px;
          padding: 0.5rem 0.75rem;
          font-size: 0.8125rem;
          outline: none;
        }
        .ff-status:focus:not(:disabled) {
          border-color: hsl(var(--primary));
          box-shadow: 0 0 0 3px hsl(var(--primary) / 0.12);
        }
        textarea.ff-status { resize: vertical; font-family: inherit; }
      `}</style>
    </section>
  );
}
