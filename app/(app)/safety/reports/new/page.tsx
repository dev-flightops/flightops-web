import Link from "next/link";

import { auth } from "@/auth";
import { todayIsoDay } from "@/lib/iso-day";
import { SAFETY_REPORT_TYPES } from "@/lib/api/safety-reports";
import { hasAnyRole } from "@/lib/roles";
import { safeReturnPath } from "@/lib/safety/return-path";
import { SAFETY_REPORT_REVIEWERS } from "@/lib/safety-roles";

import { SafetyReportForm } from "./report-form";

/**
 * /safety/reports/new — File a safety report (#58). Legacy's URL, and
 * where the red Safety button on every page goes.
 *
 * Anyone in the operation may file. `return_url` is the page the button
 * was pressed on: Cancel goes back there, and so does the report's own
 * page once it is filed.
 */
export default async function NewSafetyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ return_url?: string; type?: string; asap?: string }>;
}) {
  const query = await searchParams;
  const returnTo = safeReturnPath(query.return_url);
  // The ASAP hub's "+ File ASAP Report" (legacy linked ?asap=1).
  const startType = SAFETY_REPORT_TYPES.find((t) => t === query.type) ?? (query.asap === "1" ? "asap" : undefined);
  const session = await auth();
  const roles = session?.roles ?? [];
  const home = hasAnyRole(roles, SAFETY_REPORT_REVIEWERS) ? "/safety/reports" : "/safety/mine";
  const reporterName = session?.user?.name?.trim() || session?.user?.email || "";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          <Link href={returnTo ?? home} className="hover:text-foreground">
            {returnTo ? "← Back" : home === "/safety/reports" ? "← Safety Reports" : "← My Reports"}
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">File Safety Report</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Anything that worried you: a hazard, a near miss, a fatigue concern, a suggestion. It goes
          straight to the safety team, and you can follow it under My Reports.
        </p>
      </header>

      <SafetyReportForm
        reporterName={reporterName}
        today={todayIsoDay()}
        returnTo={returnTo}
        cancelHref={returnTo ?? home}
        startType={startType}
      />
    </div>
  );
}
