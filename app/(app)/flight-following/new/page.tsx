import { PageHeader } from "@/components/ff/page-header";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { loadZoneTable } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { listAircraft } from "@/lib/api/ops";
import type { AircraftListItem } from "@/lib/api/types";

import { OpenFlightForm } from "./open-flight-form";

/**
 * /flight-following/new — "+ Open Flight" form (M2-G-14).
 *
 * Server component fetches the tenant's aircraft list once per render
 * so the form's aircraft <select> is pre-populated. Submit goes through
 * the createFlightAction server action which calls POST /ops/flights.
 *
 * Returning a fallback page (vs throwing) for the inactive-aircraft
 * case so the user lands on a clear "fix Maintenance first" message
 * rather than a generic error boundary.
 */
export default async function FlightFollowingNewPage() {
  let aircraft: AircraftListItem[] = [];
  let loadError: string | null = null;
  // Times are typed local to the departure base (#68).
  const zones = loadZoneTable();

  try {
    aircraft = (await listAircraft()).items.filter((a) => a.is_active);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Couldn't load aircraft. Try refreshing in a moment.";
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <PageHeader
        back={{ href: "/flight-following", label: "Flight Following" }}
        title="Open New Flight"
        description={
          <>
            Adds the flight to the schedule with status{" "}
            <span className="font-semibold text-foreground">Planned</span>. Release
            through the dispatch packet once the briefing is complete.
          </>
        }
      />

      {loadError ? (
        <div
          role="alert"
          className="rounded-md border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      ) : aircraft.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            No active aircraft on this tenant.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Activate an aircraft on the Maintenance page before opening
            a flight.
          </p>
          <Button asChild variant="secondary" size="sm" className="mt-4">
            <Link href="/flight-following">← Back to board</Link>
          </Button>
        </div>
      ) : (
        <OpenFlightForm aircraft={aircraft} zones={await zones} />
      )}
    </div>
  );
}
