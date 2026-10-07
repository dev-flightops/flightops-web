"use client";

import { useState, useTransition } from "react";

import { Spinner } from "@/components/ui/spinner";
import type { QueuedPlan } from "@/lib/api/integrations";

import { assignPlanAction, ignorePlanAction } from "./actions";

/**
 * The plans pilots made in ForeFlight that no single leg fits (#55). For
 * each, the aircraft's legs within a day either side; a dispatcher puts
 * the plan on one, or sets it aside. Either decision stands through
 * later fetches.
 */

const BUTTON =
  "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent disabled:opacity-60";
const PRIMARY =
  "inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-brand-dark disabled:opacity-60";

function zulu(iso: string | null): string {
  return iso ? `${iso.slice(0, 16).replace("T", " ")}Z` : "no time given";
}

function why(plan: QueuedPlan): string {
  if (plan.match === "ambiguous") {
    return "More than one leg has its tail and airports near its time.";
  }
  if (plan.candidates.length === 0) {
    return plan.plan.tail
      ? `No flight on ${plan.plan.tail} within a day of it.`
      : "It names no aircraft.";
  }
  return "No leg of that aircraft has its airports near its time.";
}

function QueuedPlanRow({ plan }: { plan: QueuedPlan }) {
  const [choice, setChoice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const p = plan.plan;

  const assign = () =>
    startTransition(async () => {
      setError(null);
      const [flightId, leg] = choice.split("|");
      const outcome = await assignPlanAction(plan.id, flightId, Number(leg));
      if (!outcome.ok) setError(outcome.error);
    });
  const ignore = () =>
    startTransition(async () => {
      setError(null);
      const outcome = await ignorePlanAction(plan.id);
      if (!outcome.ok) setError(outcome.error);
    });

  const crew = p.crew.map((c) => c.id).filter(Boolean);
  const weightAndBalance =
    p.within_limits === null
      ? "No weight and balance yet"
      : p.within_limits
        ? "Within ForeFlight's limits"
        : "Outside ForeFlight's limits";

  return (
    <li className="px-4 py-3 text-xs">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">
          {[`${p.departure} → ${p.destination}`, p.tail ?? "no aircraft"].join(" · ")}
        </p>
        <span className="tabular-nums text-muted-foreground">{zulu(p.departs_at)}</span>
      </div>
      <p className="mt-0.5 text-muted-foreground">
        {[why(plan), weightAndBalance, crew.length > 0 ? `Crew ${crew.join(", ")}` : null]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {plan.candidates.length > 0 && (
          <>
            <label htmlFor={`leg-${plan.id}`} className="sr-only">
              Leg for this plan
            </label>
            <select
              id={`leg-${plan.id}`}
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
              className="ff-input min-w-[18rem]"
            >
              <option value="">Choose a leg…</option>
              {plan.candidates.map((c) => (
                <option key={`${c.flight_id}|${c.leg_sequence}`} value={`${c.flight_id}|${c.leg_sequence}`}>
                  {`${c.flight_number} leg ${c.leg_sequence} · ${c.origin} → ${c.destination} · ${zulu(c.departs_at)}`}
                </option>
              ))}
            </select>
            <button type="button" onClick={assign} disabled={pending || !choice} className={PRIMARY}>
              {pending && <Spinner size="xs" />}
              Put it on this leg
            </button>
          </>
        )}
        <button type="button" onClick={ignore} disabled={pending} className={BUTTON}>
          Set aside
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-status-red">
          {error}
        </p>
      )}
    </li>
  );
}

export function PlanQueue({ plans }: { plans: QueuedPlan[] }) {
  if (plans.length === 0) {
    return (
      <p className="rounded-md border border-status-green/40 bg-status-green/[0.06] px-4 py-3 text-xs">
        <span className="font-bold uppercase tracking-[0.06em] text-status-green">Nothing waiting</span>
        <span className="ml-2 text-muted-foreground">Every plan from ForeFlight is on its leg or set aside.</span>
      </p>
    );
  }
  return (
    <ul aria-label="ForeFlight plans waiting" className="divide-y divide-border rounded-xl border border-border bg-card">
      {plans.map((plan) => (
        <QueuedPlanRow key={plan.id} plan={plan} />
      ))}
    </ul>
  );
}
