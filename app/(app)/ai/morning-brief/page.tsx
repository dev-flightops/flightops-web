import { getMorningBrief } from "@/lib/api/ai";
import { listMyTenants } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

import { BriefControls } from "./brief-controls";
import { BriefView } from "./brief-view";

/**
 * /ai/morning-brief — the operational picture of the day.
 *
 * Legacy's route, kept: it is what the nav and any bookmark point at.
 *
 * No role gate, same rule as FleetBrain and the service: the brief is
 * a roll-up of numbers already on the dashboards, scoped by RLS to the
 * asker's own tenant.
 *
 * The day is resolved server-side from the caller's zone, which a
 * server component cannot read — so it rides in as the `tz` search
 * param and the service falls back to UTC without one. The nav links
 * are static and cannot carry it, so BriefControls puts the browser's
 * zone into the URL on first paint and the page renders again against
 * the right day. In the URL rather than a cookie, so a shared or
 * bookmarked link keeps meaning the day it did when it was sent.
 */

export const dynamic = "force-dynamic";

export default async function MorningBriefPage({
  searchParams,
}: {
  searchParams: Promise<{ tz?: string }>;
}) {
  const { tz } = await searchParams;

  let brief;
  let operator = "Flight Operations";
  try {
    // The operator's name is a caption, not the page — a tenant
    // lookup that fails should not cost anyone their brief.
    const [briefResult, tenants] = await Promise.all([
      getMorningBrief(tz),
      listMyTenants().catch(() => ({ tenants: [] })),
    ]);
    brief = briefResult;
    const current =
      tenants.tenants.find((t) => t.is_current) ?? tenants.tenants[0];
    operator = current?.name ?? operator;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-bold">Morning Ops Brief</h1>
        <div
          role="alert"
          className="mt-4 rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground"
        >
          {status === 401
            ? "Your session expired — please sign in again."
            : "The brief is unavailable right now. Try refreshing in a moment."}
        </div>
      </div>
    );
  }

  return (
    <BriefView
      brief={brief}
      operator={operator}
      controls={<BriefControls />}
    />
  );
}
