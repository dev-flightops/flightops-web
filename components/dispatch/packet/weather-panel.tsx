import { FlightCategoryBadge } from "@/components/weather/flight-category-badge";
import { SpecialReportChip } from "@/components/weather/special-report-chip";
import { ApiError } from "@/lib/api/client";
import { batchWeather, getVillageBoard } from "@/lib/api/weather";
import type { VillageBoardRow, WeatherReportResponse } from "@/lib/api/types";
import {
  villageAge,
  villageSky,
  villageStaleness,
  villageWind,
} from "@/lib/village-weather-format";
import {
  fieldFormat,
  metarAge,
  metarSummary,
  routeRoleFor,
  utcHm,
  type RouteRole,
} from "@/lib/weather-format";

import { EmptyPanel, SectionPanel } from "./section-panel";

// Backend caps batch at 30 requests — slice longer routes (a METAR, a
// TAF and the PIREPs per stop = 10-stop max). If the dispatcher pastes a
// wild 30-stop bush route, we show the first 10 and a footer note.
const MAX_STOPS = 10;

/**
 * Weather & ATIS panel — M2-G-14.
 *
 * Rich card layout matching the legacy peregrineflight.com style:
 *   - Panel header surfaces the airport count + pulled timestamp
 *   - Each card has a DEPARTURE / EN ROUTE / DESTINATION role pill,
 *     larger VFR/IFR badge, METAR age, sentence-case human summary,
 *     5-column field grid, then the raw METAR + TAF text blocks
 *
 * Failures degrade per-row: bad ICAOs (404) and 502s still render a
 * card, just with the parsed fields blanked and a fallback message
 * where the raw text would be.
 */
export async function WeatherPanel({ icaos }: { icaos: string[] }) {
  if (icaos.length === 0) {
    return (
      <EmptyPanel
        title="Weather & ATIS"
        hint="Pick a flight from the dropdown above, or type a routing in the Route panel, to pull METAR + TAF for every stop."
      />
    );
  }

  // Dedup preserving the dispatcher's order so role tags (DEPARTURE,
  // DESTINATION) line up with what they typed.
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const icao of icaos) {
    if (!seen.has(icao)) {
      seen.add(icao);
      uniq.push(icao);
    }
  }

  const truncated = uniq.length > MAX_STOPS;
  const stops = truncated ? uniq.slice(0, MAX_STOPS) : uniq;

  // The village observers' reports (#110): the client put one in for
  // PAII and it never reached the brief. The board is a convenience here,
  // so a failure leaves the METARs standing alone.
  const villageBoard = getVillageBoard().catch(() => null);

  // One round-trip — backend fans out concurrently to AWC.
  let batch;
  try {
    batch = await batchWeather(
      stops.flatMap((icao) => [
        { icao, kind: "metar" as const },
        { icao, kind: "taf" as const },
        { icao, kind: "pirep" as const },
      ]),
    );
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    return (
      <SectionPanel title="Weather & ATIS">
        <p className="text-xs italic text-muted-foreground">
          Weather feed unavailable ({status || "error"}) — try Refresh Weather
          in a moment.
        </p>
      </SectionPanel>
    );
  }

  // Index by (icao, kind) so each card pulls its data in O(1).
  const lookup = new Map<string, WeatherReportResponse>();
  for (const item of batch.items) {
    lookup.set(`${item.icao}/${item.kind}`, item);
  }
  const errorLookup = new Map<string, { status: number; detail: string }>();
  for (const err of batch.errors) {
    errorLookup.set(`${err.icao}/${err.kind}`, {
      status: err.status,
      detail: err.detail,
    });
  }

  // Most recent parsed_at across all reports for the panel header
  // "pulled HH:MMZ". `batch.items` is already filtered to successful
  // fetches, so this can be empty if every ICAO 404'd.
  const pulledAt = batch.items
    .map((i) => i.parsed_at)
    .sort()
    .pop();

  const villages = new Map<string, VillageBoardRow>();
  for (const row of (await villageBoard)?.items ?? []) {
    villages.set(row.airport.icao.trim().toUpperCase(), row);
  }
  const now = Date.now();

  const cards = stops.map((icao, idx) => ({
    icao,
    role: routeRoleFor(idx, stops.length),
    metar: outcomeFor(icao, "metar", lookup, errorLookup),
    taf: outcomeFor(icao, "taf", lookup, errorLookup),
    pireps: outcomeFor(icao, "pirep", lookup, errorLookup),
    village: villages.get(icao.trim().toUpperCase()) ?? null,
    now,
  }));

  return (
    <SectionPanel
      title={
        <span className="flex items-baseline gap-2">
          Weather &amp; ATIS
          <span className="text-[0.6rem] font-normal normal-case tracking-normal text-muted-foreground">
            {`${stops.length} ${stops.length === 1 ? "airport" : "airports"}${pulledAt ? ` · pulled ${utcHm(pulledAt)}` : ""}`}
          </span>
        </span>
      }
    >
      <div className="space-y-3">
        {cards.map((airport) => (
          <AirportWeather key={airport.icao} {...airport} />
        ))}
      </div>
      {truncated && (
        <p className="mt-2 text-[0.65rem] italic text-status-yellow">
          Showing first {MAX_STOPS} stops of {uniq.length}. Trim the route or
          break the trip into legs for full weather coverage.
        </p>
      )}
      <p className="mt-3 text-[0.65rem] text-muted-foreground">
        Source: Aviation Weather Center via weather-service. METAR cached 2 min,
        TAF 30 min, PIREPs (within 50 nm, last 3 hours) 15 min. ATIS is not
        shown yet.
      </p>
    </SectionPanel>
  );
}

function outcomeFor(
  icao: string,
  kind: "metar" | "taf" | "pirep",
  ok: Map<string, WeatherReportResponse>,
  bad: Map<string, { status: number; detail: string }>,
): FetchOutcome {
  const report = ok.get(`${icao}/${kind}`);
  if (report) return { ok: true, report };
  const err = bad.get(`${icao}/${kind}`);
  if (err) return { ok: false, status: err.status, message: err.detail };
  return { ok: false, status: 0, message: `no ${kind} returned for ${icao}` };
}

type FetchOutcome =
  | { ok: true; report: WeatherReportResponse }
  | { ok: false; status: number; message: string };

// ---- Airport card ------------------------------------------------------------

function AirportWeather({
  icao,
  role,
  metar,
  taf,
  pireps,
  village,
  now,
}: {
  icao: string;
  role: RouteRole | null;
  metar: FetchOutcome;
  taf: FetchOutcome;
  pireps: FetchOutcome;
  /** The stop's row on the Village Weather Board, when it's a village. */
  village: VillageBoardRow | null;
  now: number;
}) {
  return (
    <div className="rounded-md border border-border bg-card/40 p-4">
      <AirportHeader icao={icao} role={role} metar={metar} />

      {metar.ok && <MetarSummaryAndGrid report={metar.report} />}

      {village ? <VillageReport row={village} now={now} /> : null}

      <div className="mt-3 space-y-3">
        <ReportBlock label="METAR" outcome={metar} />
        <ReportBlock label="TAF" outcome={taf} />
        <ReportBlock label="PIREPs" outcome={pireps} />
      </div>
    </div>
  );
}

function AirportHeader({
  icao,
  role,
  metar,
}: {
  icao: string;
  role: RouteRole | null;
  metar: FetchOutcome;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <div className="flex items-baseline gap-2">
        {role && <RoleTag role={role} />}
        <span className="font-mono text-base font-semibold text-foreground">
          {icao}
        </span>
        {metar.ok && metar.report.flight_category && (
          <FlightCategoryBadge
            category={metar.report.flight_category}
            size="lg"
          />
        )}
        <span className="text-xs text-muted-foreground">
          Official METAR/TAF
        </span>
      </div>
      {metar.ok && (
        <span className="flex items-baseline gap-2 text-xs text-muted-foreground">
          <SpecialReportChip raw={metar.report.raw} />
          METAR age: {metarAge(metar.report.parsed_at)}
        </span>
      )}
    </div>
  );
}

/** The village observer's latest report, for a quick reference beside
 *  the METAR (#110), and whether the field has an instrument approach. */
function VillageReport({ row, now }: { row: VillageBoardRow; now: number }) {
  const r = row.latest_report;
  const noApproach = row.airport.has_instrument_approach === false;
  const reportedAt = r ? new Date(r.reported_at).getTime() : 0;
  const stale = r ? villageStaleness(reportedAt, now) : null;
  const who = r ? (r.reported_by?.full_name ?? r.reported_by_name) : null;
  const conditions = r
    ? [
        r.flight_category,
        villageSky(r),
        villageWind(r),
        r.temperature_c != null ? `${r.temperature_c}°C` : null,
        r.altimeter_in_hg != null ? `${r.altimeter_in_hg.toFixed(2)}"` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  return (
    <div className="mt-3 border-l-[3px] border-l-status-blue pl-3">
      <p className="eyebrow">Village Report</p>
      {r ? (
        <>
          <p className="mt-1 text-sm font-semibold text-foreground">{conditions || "—"}</p>
          {r.notes ? <p className="text-xs text-foreground">{r.notes}</p> : null}
          <p
            className={`mt-0.5 text-[0.7rem] ${
              stale === "red"
                ? "text-status-red"
                : stale === "yellow"
                  ? "text-status-yellow"
                  : "text-muted-foreground"
            }`}
          >
            {`${utcHm(r.reported_at)}${who ? ` by ${who}` : ""} · ${villageAge(now - reportedAt)} ago${
              stale === "red" ? " — older than 4 hours" : stale === "yellow" ? " — older than 2 hours" : ""
            }`}
          </p>
        </>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">No report from the village yet.</p>
      )}
      {noApproach ? (
        <p className="mt-1 text-[0.7rem] text-muted-foreground">
          No instrument approach: the company&rsquo;s dispatch minimums hold every flight here.
        </p>
      ) : null}
    </div>
  );
}

function MetarSummaryAndGrid({ report }: { report: WeatherReportResponse }) {
  const summary = metarSummary(report);
  return (
    <>
      {summary && (
        <p className="m-0 mb-3 text-[0.95rem] font-bold leading-snug text-foreground">
          {summary}.
        </p>
      )}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <FieldCell label="Ceiling" value={fieldFormat.ceiling(report)} />
        <FieldCell label="Visibility" value={fieldFormat.visibility(report)} />
        <FieldCell label="Wind" value={fieldFormat.wind(report)} />
        <FieldCell label="Temp / Dew" value={fieldFormat.tempDew(report)} />
        <FieldCell label="Altimeter" value={fieldFormat.altimeter(report)} />
      </dl>
    </>
  );
}

function FieldCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow">
        {label}
      </dt>
      <dd className="m-0 text-sm font-bold text-foreground">{value}</dd>
    </div>
  );
}

function ReportBlock({
  label,
  outcome,
}: {
  label: string;
  outcome: FetchOutcome;
}) {
  return (
    <div>
      <p className="mb-0.5 eyebrow">
        {label}
      </p>
      {outcome.ok && outcome.report.kind === "pirep" && !outcome.report.raw ? (
        <p className="m-0 text-[0.7rem] italic text-muted-foreground">
          None within 50 nm in the last 3 hours.
        </p>
      ) : outcome.ok ? (
        <pre className="m-0 whitespace-pre-wrap break-words font-mono text-[0.7rem] leading-snug text-foreground/90">
          {outcome.report.raw}
        </pre>
      ) : (
        <p className="m-0 text-[0.7rem] italic text-muted-foreground">
          {outcome.status === 404
            ? `No current ${label} for this airport.`
            : outcome.status === 502
              ? `${label} feed unreachable — try Refresh Weather.`
              : `${label} unavailable (${outcome.status || "error"}).`}
        </p>
      )}
    </div>
  );
}

// ---- Tag / badge components --------------------------------------------------

// The stop's role as a quiet label (#80), not a tinted tag.
const ROLE_TAG_STYLE: Record<RouteRole, string> = {
  DEPARTURE: "text-status-blue",
  "EN ROUTE": "text-muted-foreground",
  DESTINATION: "text-status-blue",
};

function RoleTag({ role }: { role: RouteRole }) {
  return (
    <span
      className={
        "status-mark text-[0.6rem] " +
        ROLE_TAG_STYLE[role]
      }
    >
      {role}
    </span>
  );
}
