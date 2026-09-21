import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import { listStations } from "@/lib/api/ground";
import type { StationListItem } from "@/lib/api/types";
import { safeReturnPath } from "@/lib/safety/return-path";

import { ReportForm } from "./report-form";

/**
 * /safety/report — File a new hazard.
 *
 * Any authenticated user can submit; SMS reporting is intentionally
 * frictionless. Stations dropdown is optional — reporters can leave it
 * blank and use the free-text location instead.
 *
 * The station list is fetched server-side + passed as a prop so the
 * client form has zero data-fetching responsibility.
 *
 * `return_url` is set by the global red Safety button so the reporter
 * can get back to the page they were pulled off — legacy passes the
 * same param from its FAB. It only ever labels the back link; filing
 * still redirects to the new hazard so the reporter sees its status.
 */
export default async function SafetyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ return_url?: string }>;
}) {
  const returnTo = safeReturnPath((await searchParams).return_url);

  let stations: StationListItem[] = [];
  try {
    stations = (await listStations({ limit: 200 })).items;
  } catch (err) {
    // Station dropdown is optional — a load failure just means the
    // reporter falls back to free-text location. Don't block filing.
    if (err instanceof ApiError && err.status !== 401) {
      stations = [];
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          <Link
            href={returnTo ?? "/safety"}
            className="hover:text-foreground"
          >
            {returnTo ? "← Back" : "← Safety SMS"}
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          File a Hazard
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Safety reports go straight to the Safety Officer&rsquo;s triage
          inbox. Everything you file is confidential — you can request
          your name be hidden with the &ldquo;anonymous&rdquo; checkbox
          at the bottom.
        </p>
      </header>

      <ReportForm stations={stations} />
    </div>
  );
}
