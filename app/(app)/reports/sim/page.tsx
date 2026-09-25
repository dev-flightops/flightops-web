import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import {
  getSimExport,
  type SimBasis,
  type SimExport,
} from "@/lib/api/reports";

import { downloadSimFileAction } from "./actions";
import { ExportControls } from "./export-controls";

/**
 * /reports/sim — schedule data export.
 *
 * Legacy is `templates/reservations/sim_export.html`: three
 * quick-export tiles, a custom-export form, a panel listing the fields
 * a SIM file contains, and a saved-configurations table. It has no
 * preview — you pick a format and a file downloads, and the only way to
 * see what you just published is to open it.
 *
 * This page is the preview. The counts and the table come from the same
 * report object the download is built from, so what was reviewed and
 * what left the building cannot disagree. That is the pattern the five
 * regulatory filings already use, and a schedule export has the same
 * property that makes it matter: it goes out under the operator's
 * carrier code, to somebody who will act on it.
 *
 * THE THREE THINGS THIS PAGE SAYS THAT LEGACY'S DOES NOT
 *
 * That a schedule record is not a flight. Legacy emits one record per
 * departure with schedule-level fields filled in, so three Tuesdays of
 * one weekly service become three records each claiming to operate
 * every Tuesday. Here the two are separate bases, and the schedule
 * basis shows how many departures back each service.
 *
 * That a fixed-width file can be lossy. Legacy's writer pads short
 * values and passes long ones through, so an overlong field shifts
 * every column after it and the record still looks well-formed. Ours
 * truncates and counts, and the count is on this page.
 *
 * That the carrier code is the operator's. Legacy hardcodes one. With
 * none set this page offers no export at all, because a guessed code
 * files these flights under somebody else's designator.
 */

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_WINDOW_DAYS = 7;

const SERVICE_TYPE: Record<string, string> = {
  J: "Scheduled",
  C: "Charter",
};

/** ISO date n days from today, in UTC. Matches the service's default
 *  window so the first render and the first download agree. */
function isoDay(offset: number): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset),
  )
    .toISOString()
    .slice(0, 10);
}

/** HHMM as HH:MM. The wire format is what the file carries; a screen
 *  should not make the reader parse it. */
function clock(hhmm: string): string {
  return hhmm.length === 4 ? `${hhmm.slice(0, 2)}:${hhmm.slice(2)}` : "—";
}

/** Seven positions, Monday first. Renders the operating days as day
 *  names, because "1.3...." is a field layout and not something a
 *  person reads. */
function days(frequency: string): string {
  const NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const on = NAMES.filter((_, i) => frequency[i] !== "." && frequency[i]);
  return on.length === 7 ? "Daily" : on.join(" ");
}

const TH =
  "px-2 py-1.5 text-left text-[0.6rem] font-bold uppercase tracking-[0.06em] text-muted-foreground";

function TD({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-2 py-1.5 text-xs ${className}`}>{children}</td>;
}

/** An absence, with the reason on hover. Used wherever the export
 *  itself carries a null — never for a zero. */
function Missing({ why }: { why: string }) {
  return (
    <span title={why} className="text-muted-foreground">
      —
    </span>
  );
}

function Count({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string | number;
  sub: string;
  tone?: "amber";
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <p className="text-[0.55rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p
        className={
          "mt-0.5 text-lg font-semibold tabular-nums " +
          (tone === "amber" ? "text-status-yellow" : "text-foreground")
        }
      >
        {value}
      </p>
      <p className="mt-0.5 text-[0.65rem] text-muted-foreground">{sub}</p>
    </div>
  );
}

function CarrierCodeMissing() {
  return (
    <div className="rounded-xl border border-status-yellow/40 bg-status-yellow/5 p-4">
      <h2 className="text-sm font-semibold text-status-yellow">
        No carrier code is set for this operator
      </h2>
      <p className="mt-1.5 text-xs text-muted-foreground">
        A schedule export is filed under the carrier code, and whatever
        ingests it keys on that code to decide whose flights these are.
        A guessed one would not produce a slightly wrong file — it would
        file your schedule under another operator&rsquo;s designator,
        somewhere you cannot see it and with nothing marking it as a
        guess. So nothing is generated until the code is set.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Set the two-character IATA or three-character ICAO designator on{" "}
        <Link
          href="/settings/company"
          className="font-semibold text-primary hover:underline"
        >
          Settings → Company Profile
        </Link>
        , then come back.
      </p>
    </div>
  );
}

function ScheduleTable({ report }: { report: SimExport }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[54rem] border-collapse">
        <caption className="sr-only">
          Recurring services in the export window
        </caption>
        <thead className="bg-muted/30">
          <tr>
            <th className={TH}>Flight</th>
            <th className={TH}>Service</th>
            <th className={TH}>Route</th>
            <th className={TH}>Depart</th>
            <th className={TH}>Arrive</th>
            <th className={TH}>Operating days</th>
            <th className={TH}>Effective</th>
            <th className={TH}>Departures</th>
            <th className={TH}>Aircraft</th>
            <th className={TH}>Seats</th>
          </tr>
        </thead>
        <tbody>
          {report.schedule.map((r) => (
            <tr
              key={`${r.flight_number}-${r.origin}-${r.destination}-${r.departure_time}`}
              data-testid={`service-${r.flight_number}-${r.departure_time}`}
              className="border-t border-border"
            >
              <TD className="font-mono font-semibold">{r.flight_number}</TD>
              <TD className="text-muted-foreground">
                {SERVICE_TYPE[r.service_type] ?? r.service_type}
              </TD>
              <TD className="font-mono">
                {r.origin}–{r.destination}
              </TD>
              <TD className="tabular-nums">{clock(r.departure_time)}</TD>
              <TD className="tabular-nums">{clock(r.arrival_time)}</TD>
              <TD>{days(r.frequency)}</TD>
              <TD className="tabular-nums text-muted-foreground">
                {r.effective_from === r.effective_to
                  ? r.effective_from
                  : `${r.effective_from} → ${r.effective_to}`}
              </TD>
              {/* A weekly pattern inferred from one departure is a
                  guess, and the reader should be able to see which
                  rows are guesses. */}
              <TD className="tabular-nums">
                {r.operates}
                {r.operates === 1 && (
                  <span
                    title="One departure — the operating-day pattern is inferred from a single flight"
                    className="ml-1 text-status-yellow"
                  >
                    ·
                  </span>
                )}
              </TD>
              <TD>
                {r.aircraft_type ? (
                  <span className="font-mono">{r.aircraft_type}</span>
                ) : (
                  <Missing why="No aircraft type on file — this field is blank in the export" />
                )}
              </TD>
              <TD className="tabular-nums">{r.seats}</TD>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FlightsTable({ report }: { report: SimExport }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[58rem] border-collapse">
        <caption className="sr-only">Departures in the export window</caption>
        <thead className="bg-muted/30">
          <tr>
            <th className={TH}>Date</th>
            <th className={TH}>Flight</th>
            <th className={TH}>Route</th>
            <th className={TH}>Sched</th>
            <th className={TH}>Actual</th>
            <th className={TH}>Booked</th>
            <th className={TH}>Manifested</th>
            <th className={TH}>Cargo</th>
            <th className={TH}>Mail</th>
            <th className={TH}>Status</th>
          </tr>
        </thead>
        <tbody>
          {report.flights.map((f) => (
            <tr
              key={`${f.flight_date}-${f.flight_number}-${f.scheduled_departure}`}
              data-testid={`flight-${f.flight_number}-${f.flight_date}`}
              className="border-t border-border"
            >
              <TD className="tabular-nums">{f.flight_date}</TD>
              <TD className="font-mono font-semibold">{f.flight_number}</TD>
              <TD className="font-mono">
                {f.origin}–{f.destination}
              </TD>
              <TD className="tabular-nums">
                {clock(f.scheduled_departure)}
              </TD>
              <TD className="tabular-nums">
                {f.actual_departure ? (
                  clock(f.actual_departure)
                ) : (
                  <Missing why="Not departed, or no actual time recorded — the export leaves this empty rather than repeating the scheduled time" />
                )}
              </TD>
              <TD className="tabular-nums">
                {f.pax_booked === null ? (
                  <Missing why="No booking is linked to this flight — nothing was sold against it in the system, which is not the same as nobody buying a seat" />
                ) : (
                  f.pax_booked
                )}
              </TD>
              {/* The zero-versus-gap distinction, on screen as well as
                  in the file: a locked manifest with nobody on it flew
                  empty, and no manifest means nobody counted. */}
              <TD className="tabular-nums">
                {f.pax_manifested === null ? (
                  <Missing why="No manifest locked — nobody counted, which is not the same as nobody aboard" />
                ) : (
                  f.pax_manifested
                )}
              </TD>
              <TD className="tabular-nums">
                {f.cargo_lbs ? `${f.cargo_lbs.toLocaleString()} lb` : "—"}
              </TD>
              <TD className="tabular-nums">
                {f.mail_lbs ? `${f.mail_lbs.toLocaleString()} lb` : "—"}
              </TD>
              <TD className="text-muted-foreground">{f.status}</TD>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function SimExportPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string; basis?: string }>;
}) {
  const params = await searchParams;
  const start =
    params.start && DATE_RE.test(params.start) ? params.start : isoDay(0);
  const end =
    params.end && DATE_RE.test(params.end)
      ? params.end
      : isoDay(DEFAULT_WINDOW_DAYS);
  const basis: SimBasis = params.basis === "flights" ? "flights" : "schedule";

  let report: SimExport | null = null;
  let carrierMissing = false;
  let loadError: string | null = null;

  try {
    report = await getSimExport(start, end, basis);
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      carrierMissing = true;
    } else if (err instanceof ApiError) {
      loadError =
        err.status === 422
          ? "That window was refused — check the dates are in order and no more than a year apart."
          : `reports-service refused the request (HTTP ${err.status}).`;
    } else {
      loadError = "Could not reach reports-service.";
    }
  }

  const records = report
    ? basis === "schedule"
      ? report.schedule.length
      : report.flights.length
    : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Link
        href="/reports"
        className="mb-3 inline-block text-xs text-muted-foreground hover:text-foreground"
      >
        ← Reports
      </Link>
      <header className="mb-4">
        <h1 className="text-2xl font-bold">Schedule Export</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          SIM / OAG schedule data, and a per-departure extract for
          accounting
          {report ? ` · carrier ${report.carrier}` : ""}
        </p>
      </header>

      {carrierMissing && <CarrierCodeMissing />}

      {loadError && (
        <div className="rounded-xl border border-status-red/40 bg-status-red/5 p-4">
          <p className="text-sm font-semibold text-status-red">
            The export could not be built
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{loadError}</p>
        </div>
      )}

      {report && (
        <>
          <div className="mb-4 rounded-xl border border-border bg-card p-4">
            <ExportControls
              carrier={report.carrier}
              start={start}
              end={end}
              basis={basis}
              records={records}
              downloadAction={downloadSimFileAction}
            />
          </div>

          <p className="mb-4 text-xs text-muted-foreground">
            {basis === "schedule" ? (
              <>
                One record per recurring service, not per departure.{" "}
                <strong className="text-foreground">
                  {report.departures}
                </strong>{" "}
                departures in this window became{" "}
                <strong className="text-foreground">
                  {report.schedule.length}
                </strong>{" "}
                services, each carrying the days it operates and the
                dates that pattern holds between.
              </>
            ) : (
              <>
                One row per departure, carrying what was actually on it.
                Passengers appear twice because the two figures answer
                different questions: booked is what was sold, manifested
                is who the captain signed for.
              </>
            )}
          </p>

          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Count
              label={basis === "schedule" ? "Services" : "Departures"}
              value={records}
              sub={`from ${report.departures} flights`}
            />
            <Count
              label="Cancelled"
              value={report.cancelled}
              sub="excluded — would publish a service that will not fly"
            />
            <Count
              label="No aircraft type"
              value={report.without_aircraft_type}
              sub="blank in the export"
              tone={report.without_aircraft_type > 0 ? "amber" : undefined}
            />
            <Count
              label="With bookings"
              value={report.flights_with_booking}
              sub={
                report.flights_with_booking === 0
                  ? "no booking is linked to a flight in this window"
                  : "bookings linked to a departure"
              }
              tone={
                report.departures > 0 && report.flights_with_booking === 0
                  ? "amber"
                  : undefined
              }
            />
            <Count
              label="Carrying mail"
              value={report.carrying_mail}
              sub={
                basis === "schedule"
                  ? "weights are on the flights basis"
                  : "from locked manifests"
              }
            />
          </div>

          {records === 0 ? (
            <div className="rounded-xl border border-border bg-card p-6 text-center">
              <p className="text-sm font-semibold">
                No flights in this window
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {report.cancelled > 0
                  ? `${report.cancelled} cancelled ${
                      report.cancelled === 1 ? "flight" : "flights"
                    } in the window, which a schedule export does not publish.`
                  : "Nothing is scheduled between these dates."}
              </p>
            </div>
          ) : basis === "schedule" ? (
            <ScheduleTable report={report} />
          ) : (
            <FlightsTable report={report} />
          )}

          <div className="mt-4 space-y-1.5 text-[0.7rem] text-muted-foreground">
            {basis === "schedule" && (
              <p>
                The fixed-width file carries the fields above and stops
                at seats. Passenger, cargo and mail figures only exist
                on the flights basis, as CSV or XML.
              </p>
            )}
            {basis === "flights" &&
              report.departures > 0 &&
              report.flights_with_booking === 0 && (
                <p className="text-status-yellow">
                  No booking in this window carries a flight, so the
                  booked column is blank throughout rather than zero.
                  Bookings and flights are recorded separately until a
                  booking is assigned to a departure — an accounting
                  system reading a column of zeroes would bill nothing
                  for flights that carried passengers.
                </p>
              )}
            <p>
              Mail and cargo weights come from locked manifests only. A
              draft manifest is still being edited, so its weights are
              not yet a statement about what is on the aircraft.
            </p>
            <p>
              Service type is <strong>Charter</strong> for a flight a
              charter request points at, and <strong>Scheduled</strong>
              {" "}otherwise. Mail is not a service type here — it
              travels in its own column, where the{" "}
              <Link
                href="/reports"
                className="text-primary hover:underline"
              >
                regulatory returns
              </Link>{" "}
              already report it.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
