import { PageHeader } from "@/components/ff/page-header";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getCompanyProfile, loadZoneTable } from "@/lib/api/auth";
import { getCharter, type CharterRow } from "@/lib/api/charter";
import { ApiError } from "@/lib/api/client";
import { listAircraft } from "@/lib/api/ops";
import type { AircraftListItem } from "@/lib/api/types";

import { type FlightPrefill, OpenFlightForm } from "./open-flight-form";

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
export default async function FlightFollowingNewPage({
  searchParams,
}: {
  searchParams: Promise<{ charter?: string }>;
}) {
  // A confirmed charter's flight (#133): the form starts from the request.
  const { charter: charterId } = await searchParams;
  const charter = charterId ? await getCharter(charterId).catch(() => null) : null;
  let aircraft: AircraftListItem[] = [];
  let loadError: string | null = null;
  // Times are typed local to the departure base (#68).
  const zones = loadZoneTable();
  // The company's ground time at each stop (#126); 15 minutes when the
  // settings can't be read, as before there was a setting.
  const groundMinutes = getCompanyProfile()
    .then((c) => c.ground_minutes ?? 15)
    .catch(() => 15);

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
        <>
          {charterId ? <CharterNotice charter={charter} /> : null}
          <OpenFlightForm
            aircraft={aircraft}
            zones={await zones}
            groundMinutesDefault={await groundMinutes}
            prefill={charter ? charterPrefill(charter) : undefined}
          />
        </>
      )}
    </div>
  );
}

/** The pipeline's reference for a charter, as its table shows it. */
function charterRef(id: string): string {
  return `CHR-${id.slice(0, 8).toUpperCase()}`;
}

function CharterNotice({ charter }: { charter: CharterRow | null }) {
  if (!charter) {
    return (
      <div role="alert" className="notice notice-yellow mb-5 text-sm">
        That charter couldn&rsquo;t be loaded, so this flight won&rsquo;t be linked to it.
      </div>
    );
  }
  const laterReturn = charter.return_date && charter.return_date !== charter.requested_date;
  return (
    <div role="note" className="notice notice-blue mb-5 text-sm">
      {`The flight for charter ${charterRef(charter.id)}, ${charter.customer_name ?? "the customer"}, ${
        charter.pax_count
      } passengers. Pick the aircraft; opening the flight links it to the charter.${
        laterReturn ? ` The return on ${charter.return_date} is a flight of its own.` : ""
      }`}
    </div>
  );
}

/** The request as the form's starting values. A requested time is taken
 *  only as HH:MM; anything else is left for the dispatcher to type. */
function charterPrefill(charter: CharterRow): FlightPrefill {
  const time = /^(\d{1,2}):(\d{2})$/.exec((charter.requested_time ?? "").trim());
  return {
    flight_number: charterRef(charter.id),
    origin: charter.origin_icao,
    destination: charter.destination_icao,
    scheduled_departure_at: time
      ? `${charter.requested_date}T${time[1].padStart(2, "0")}:${time[2]}`
      : "",
    round_trip: charter.return_date === charter.requested_date,
    pax_count: String(charter.pax_count),
    cargo_lbs: String(Math.round(Number(charter.cargo_lbs) || 0)),
    notes: [`Charter for ${charter.customer_name ?? "the customer"}`, charter.special_requirements]
      .filter(Boolean)
      .join(". ")
      .slice(0, 500),
    charter_request_id: charter.id,
  };
}
