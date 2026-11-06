"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { buttonOutline, buttonSolid, linkCaps } from "@/components/ff/controls";
import { Spinner } from "@/components/ui/spinner";
import type { MxClock } from "@/lib/api/maintenance";

import { moveOnClockAction, stampMilestoneAction } from "./actions";

/** A running clock (#172): its hours, who's on it, and its milestones. */
export function ClockCard({
  clock,
  canRun,
  started,
  stamps,
}: {
  clock: MxClock;
  canRun: boolean;
  /** "Nov 5, 09:30", in the company's time, from the server. */
  started: string;
  /** Each milestone's stamped time, the same way, by key. */
  stamps: Record<string, string>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: true } | { ok: false; message: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <article aria-label={`Clock on ${clock.aircraft.tail_number}`} className="rounded-lg border-l-2 border border-border border-l-status-green bg-card p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex flex-wrap items-baseline gap-3">
            <Link href={`/maintenance/aircraft/${clock.aircraft.id}`} className="font-mono text-lg font-bold text-foreground hover:underline">
              {clock.aircraft.tail_number}
            </Link>
            {clock.aircraft.model ? <span className="text-xs text-muted-foreground">{clock.aircraft.model}</span> : null}
            <span className="font-mono text-lg font-bold text-status-green">{clock.elapsed_hours.toFixed(1)}h</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Started {started} by {clock.started_by}
            {clock.notes ? ` · ${clock.notes}` : ""}
            {clock.work_order_id ? (
              <>
                {" · "}
                <Link href={`/maintenance/work-orders/${clock.work_order_id}`} className="font-mono text-primary hover:underline">
                  {clock.wo_number}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        {canRun ? (
          <button
            type="button"
            disabled={pending}
            className={buttonSolid}
            onClick={() => {
              if (window.confirm(`Complete maintenance on ${clock.aircraft.tail_number}?`)) {
                run(() => moveOnClockAction(clock.id, "complete"));
              }
            }}
          >
            Complete
          </button>
        ) : null}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="field-label mb-0">Mechanics</span>
        {clock.mechanics.length === 0 ? <span className="text-muted-foreground">Nobody on it</span> : null}
        {clock.mechanics.map((m) => (
          <span key={m.user_id} className="status-mark text-status-green">
            {m.name}
          </span>
        ))}
        {canRun ? (
          clock.on_clock ? (
            <button type="button" disabled={pending} className={linkCaps} onClick={() => run(() => moveOnClockAction(clock.id, "leave"))}>
              Leave
            </button>
          ) : (
            <button type="button" disabled={pending} className={linkCaps} onClick={() => run(() => moveOnClockAction(clock.id, "join"))}>
              + Join
            </button>
          )
        ) : null}
        {pending ? <Spinner size="xs" /> : null}
      </div>

      <ul aria-label="Milestones" className="flex flex-wrap gap-2">
        {clock.milestones.map((m) => (
          <li key={m.key}>
            {m.at ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-status-green px-2 py-1 text-xs text-status-green">
                {m.label} <span className="font-mono">{stamps[m.key]}</span>
              </span>
            ) : canRun ? (
              <button type="button" disabled={pending} className={buttonOutline} onClick={() => run(() => stampMilestoneAction(clock.id, m.key))}>
                {m.label}
              </button>
            ) : (
              <span className="inline-flex rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">{m.label}</span>
            )}
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-status-red">
          {error}
        </p>
      ) : null}
    </article>
  );
}
