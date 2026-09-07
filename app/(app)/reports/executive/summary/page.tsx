import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ApiError } from "@/lib/api/client";
import { getExecutiveSummary } from "@/lib/api/reports";
import { hasAnyRole, roleGate } from "@/lib/roles";

import { SummaryView } from "./summary-view";

/**
 * /reports/executive/summary — the sixty-second read.
 *
 * Gated, unlike FleetBrain and the morning brief. Those roll up
 * numbers already on the dashboards; this one carries revenue, cost
 * and margin. The service enforces the same set, so the gate here is
 * about not rendering a shell someone cannot fill rather than about
 * security.
 */

const EXEC_READERS = roleGate(
  "exec_admin",
  "director_of_operations",
  "chief_pilot",
);

export const dynamic = "force-dynamic";

export default async function ExecutiveSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ tz?: string }>;
}) {
  const session = await auth();
  // session.roles, not session.user.roles — the latter is undefined,
  // so reading it gates every role out including exec-admin. The rest
  // of the app reads it the same way; this is the odd one out until
  // it isn't.
  const roles = session?.roles ?? [];
  if (!hasAnyRole(roles, EXEC_READERS)) {
    redirect("/home/");
  }

  const { tz } = await searchParams;

  let summary;
  try {
    summary = await getExecutiveSummary(tz);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-bold">Executive Summary</h1>
        <div
          role="alert"
          className="mt-4 rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground"
        >
          {status === 401
            ? "Your session expired — please sign in again."
            : status === 403
              ? "You need Exec Admin, Director of Operations or Chief Pilot to view this report."
              : "The report is unavailable right now. Try refreshing in a moment."}
        </div>
      </div>
    );
  }

  return <SummaryView summary={summary} />;
}
