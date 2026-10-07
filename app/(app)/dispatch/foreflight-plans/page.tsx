import Link from "next/link";

import { auth } from "@/auth";
import { ApiError } from "@/lib/api/client";
import { getPlanQueue, type QueuedPlan } from "@/lib/api/integrations";
import { PLAN_REVIEWERS, hasAnyRole } from "@/lib/roles";

import { PlanQueue } from "./plan-queue";

/**
 * /dispatch/foreflight-plans: plans pilots made in ForeFlight that no
 * single leg fits (#55). A plan for a leg we sent comes back on it, and
 * a pilot's own plan with one leg of the same tail and airports near its
 * time lands there by itself; the rest wait here. Placing them is
 * dispatch's and the DO's: PLAN_REVIEWERS, as ops has it.
 */

export const dynamic = "force-dynamic";

export default async function ForeFlightPlansPage() {
  const session = await auth();
  const canPlace = hasAnyRole(session?.roles ?? [], PLAN_REVIEWERS);
  let plans: QueuedPlan[] | null = null;
  let loadError: string | null = null;
  if (canPlace) {
    try {
      plans = await getPlanQueue();
    } catch (err) {
      loadError =
        err instanceof ApiError && err.status === 401
          ? "Your session expired. Sign in again."
          : "The waiting plans couldn't be loaded. Try refreshing in a moment.";
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <nav className="mb-4 text-xs text-muted-foreground">
        <Link href="/dispatch" className="hover:text-foreground">
          Dispatch
        </Link>
        <span className="px-1.5">/</span>
        <span className="text-foreground">ForeFlight plans</span>
      </nav>
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">ForeFlight plans waiting</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Plans pilots made in ForeFlight that no single leg fits. Put each on its leg, so it shows on
          that flight&rsquo;s dispatch page beside Peregrine&rsquo;s weight and balance, or set it aside.
          Either choice stands when ForeFlight sends the plan again.
        </p>
      </header>
      {!canPlace ? (
        <p className="rounded-md border border-border bg-muted/60 px-3 py-3 text-xs text-muted-foreground">
          A dispatcher, the Director of Operations or an Exec Admin places ForeFlight plans.
        </p>
      ) : loadError || !plans ? (
        <p
          role="alert"
          className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-3 text-xs text-status-red"
        >
          {loadError ?? "The waiting plans couldn't be loaded."}
        </p>
      ) : (
        <PlanQueue plans={plans} />
      )}
    </div>
  );
}
