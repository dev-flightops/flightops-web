import { ApiError } from "@/lib/api/client";
import { listFlights } from "@/lib/api/ops";
import type { FlightListItem } from "@/lib/api/types";

import { DayPicker } from "./day-picker";
import { FlightRiskList } from "./flight-risk-list";

/**
 * /ai/delay-alerts — Predictive Delay Alerts.
 *
 * Legacy's route and shape (`templates/ai/delay_alerts.html`): the
 * day's flights, each with an on-demand risk assessment.
 *
 * THE DAY IS A CONTROL, NOT A CONSTANT
 *
 * Legacy shows today and only today. The dispatch packet did the same
 * and it was the single biggest thing wrong with the system when the
 * client walked it on 9 September — a flight built for tomorrow could
 * not be reached at all. Delay risk is most useful *before* the day
 * starts, so shipping this pinned to today would repeat a mistake we
 * have already had reported to us once.
 *
 * WHAT LEGACY'S HEADER STATS ARE NOT HERE
 *
 * Legacy tops the page with Historical Flights / Delays Recorded /
 * Delay Rate across the whole operation. Computing that here needs a
 * second definition of "late" living in the page, and the assessment
 * service already owns one — it returns `late_rate` per route with its
 * own rules about what counts and when there is too little history to
 * say. Two implementations of "late" drift, and the one on screen
 * would be the one nobody enforced.
 *
 * So the count in the header is a count of flights, which is
 * unambiguous, and every rate on this page comes from the service.
 */

export const dynamic = "force-dynamic";

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function DelayAlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: dateParam } = await searchParams;
  // Validated rather than trusted: a malformed date passed to the API
  // as a filter returns nothing, which reads as "no flights" instead
  // of "bad date".
  const date =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayUtc();

  let flights: FlightListItem[] = [];
  let loadError: string | null = null;
  let forbidden = false;

  try {
    flights = (await listFlights({ onDate: date, limit: 200 })).items;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    forbidden = status === 403;
    loadError =
      status === 403
        ? "Delay Alerts is limited to dispatchers, chief pilots, the director of operations and admins."
        : "Could not load the day's flights just now.";
  }

  // Cancelled flights are dropped: there is no delay risk on a flight
  // that is not going, and leaving them in pads the list with rows
  // whose Assess button answers a question nobody asked.
  const assessable = flights.filter((f) => f.status !== "cancelled");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Predictive Delay Alerts
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {assessable.length} flight{assessable.length === 1 ? "" : "s"} on{" "}
            {date} (UTC)
            {flights.length !== assessable.length &&
              ` · ${flights.length - assessable.length} cancelled, not shown`}
          </p>
        </div>
        <DayPicker date={date} />
      </header>

      {loadError ? (
        <p
          role="alert"
          className="rounded-md border border-status-red/30 bg-status-red/10 px-3 py-2 text-sm text-status-red"
        >
          {loadError}
        </p>
      ) : (
        <>
          <p className="mb-4 rounded-md border border-status-blue/30 bg-status-blue/10 px-3 py-2 text-xs text-status-blue">
            Each assessment reads that flight&apos;s own route history and its
            aircraft&apos;s squawk and MEL state. Run it per flight, when you
            want it.
          </p>
          {!forbidden && <FlightRiskList flights={assessable} />}
        </>
      )}
    </div>
  );
}
