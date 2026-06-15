import Link from "next/link";

import { listCompanyBases } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import type {
  CompanyBaseResponse,
  WeatherBatchResponse,
  WeatherReportResponse,
} from "@/lib/api/types";
import { batchWeather } from "@/lib/api/weather";

/**
 * /village-wx — Bush / village airport weather panel.
 *
 * Part 135 ops in Alaska + similar regions fly into a fixed roster of
 * "village" airports — the same dozen-or-two ICAOs every day. This
 * page renders a one-glance METAR + TAF table for those airports so
 * the dispatcher doesn't have to re-type ICAOs into /weather.
 *
 * Airport roster comes from /settings/bases — non-hub active bases
 * are treated as villages by default; switch the filter to "all" to
 * include hubs. Weather data is batched via /weather/batch (capped 20
 * per call by backend — we slice to 20 client-side, matching
 * /weather's existing behavior).
 */
const MAX_BATCH = 20;

export default async function VillageWxPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const { scope } = await searchParams;
  const includeHubs = scope === "all";

  let bases: CompanyBaseResponse[] = [];
  let basesError: string | null = null;
  try {
    const response = await listCompanyBases();
    bases = response.items.filter((b) => b.is_active);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    basesError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Bases unavailable. Add bases in Settings → Bases.";
  }

  const villageBases = includeHubs
    ? bases
    : bases.filter((b) => !b.is_hub);
  const sliced = villageBases.slice(0, MAX_BATCH);

  let weather: WeatherBatchResponse | null = null;
  let weatherError: string | null = null;
  if (sliced.length > 0) {
    try {
      weather = await batchWeather(
        sliced.flatMap((b) => [
          { icao: b.icao, kind: "metar" as const },
          { icao: b.icao, kind: "taf" as const },
        ]),
      );
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      weatherError =
        status === 401
          ? "Your session expired — please sign in again."
          : "Weather feed unavailable. Try refreshing in a moment.";
    }
  }

  // Build a per-ICAO lookup so the table can render each base with its
  // METAR + TAF side by side, surfacing nulls cleanly when one is missing.
  const reportsByIcao = new Map<
    string,
    { metar: WeatherReportResponse | null; taf: WeatherReportResponse | null }
  >();
  if (weather) {
    for (const item of weather.items) {
      const icao = item.icao.toUpperCase();
      const slot = reportsByIcao.get(icao) ?? { metar: null, taf: null };
      if (item.kind === "metar") slot.metar = item;
      if (item.kind === "taf") slot.taf = item;
      reportsByIcao.set(icao, slot);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Village Wx</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            METAR + TAF for your active bases — recheck before every
            village run
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/village-wx"
            className={
              includeHubs
                ? "rounded-md border border-border bg-card px-2.5 py-1 hover:bg-muted/40"
                : "rounded-md border border-status-blue bg-status-blue/15 px-2.5 py-1 font-semibold text-status-blue"
            }
          >
            Villages only
          </Link>
          <Link
            href="/village-wx?scope=all"
            className={
              includeHubs
                ? "rounded-md border border-status-blue bg-status-blue/15 px-2.5 py-1 font-semibold text-status-blue"
                : "rounded-md border border-border bg-card px-2.5 py-1 hover:bg-muted/40"
            }
          >
            All bases
          </Link>
        </div>
      </header>

      {basesError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
        >
          {basesError}
        </div>
      )}

      {weatherError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
        >
          {weatherError}
        </div>
      )}

      {!basesError && villageBases.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-card/40 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {includeHubs
              ? "No active bases yet."
              : "No village bases configured. Add bases in Settings → Bases (anything not flagged as a hub appears here)."}
          </p>
          <Link
            href="/settings/bases"
            className="mt-3 inline-block text-xs font-semibold text-status-blue hover:underline"
          >
            Manage bases →
          </Link>
        </div>
      )}

      {villageBases.length > MAX_BATCH && (
        <div className="mb-4 rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow">
          Showing the first {MAX_BATCH} of {villageBases.length} bases
          — backend caps weather batches at {MAX_BATCH} ICAOs. Use{" "}
          <Link href="/weather" className="font-semibold underline">
            /weather
          </Link>{" "}
          for the full roster.
        </div>
      )}

      {sliced.length > 0 && (
        <section className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/20 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2 text-left">Base</th>
                <th scope="col" className="px-4 py-2 text-left">Category</th>
                <th scope="col" className="px-4 py-2 text-left">METAR</th>
                <th scope="col" className="px-4 py-2 text-left">TAF</th>
              </tr>
            </thead>
            <tbody>
              {sliced.map((b) => {
                const reports =
                  reportsByIcao.get(b.icao) ?? { metar: null, taf: null };
                return (
                  <tr
                    key={b.id}
                    className="border-b border-border last:border-b-0 align-top"
                  >
                    <td className="px-4 py-3">
                      <div className="font-mono text-sm font-semibold text-foreground">
                        {b.icao}
                      </div>
                      <div className="text-[0.7rem] text-muted-foreground">
                        {b.display_name}
                      </div>
                      {b.is_hub && (
                        <span className="mt-1 inline-block rounded-sm border border-status-blue/40 bg-status-blue/10 px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.08em] text-status-blue">
                          Hub
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {reports.metar ? (
                        <CategoryChip
                          category={reports.metar.flight_category}
                          alternateRequired={
                            reports.metar.alternate_required ?? false
                          }
                        />
                      ) : (
                        <span className="text-[0.7rem] text-muted-foreground">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-md">
                      {reports.metar ? (
                        <RawReport report={reports.metar} />
                      ) : (
                        <span className="text-[0.7rem] text-muted-foreground">
                          No METAR available.
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-md">
                      {reports.taf ? (
                        <RawReport report={reports.taf} />
                      ) : (
                        <span className="text-[0.7rem] text-muted-foreground">
                          No TAF available.
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {weather && weather.errors.length > 0 && (
        <section className="mt-4 rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow">
          <p className="font-semibold">
            {weather.errors.length} ICAO{weather.errors.length === 1 ? "" : "s"}{" "}
            had a fetch problem:
          </p>
          <ul className="mt-1 list-disc pl-5">
            {weather.errors.map((e, idx) => (
              <li key={`${e.icao}-${e.kind}-${idx}`}>
                <span className="font-mono">{e.icao}</span> {e.kind} —{" "}
                {e.detail || `HTTP ${e.status}`}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function CategoryChip({
  category,
  alternateRequired,
}: {
  category: string | null;
  alternateRequired: boolean;
}) {
  const palette: Record<string, string> = {
    VFR: "border-status-green/40 bg-status-green/10 text-status-green",
    MVFR: "border-status-blue/40 bg-status-blue/10 text-status-blue",
    IFR: "border-status-yellow/40 bg-status-yellow/10 text-status-yellow",
    LIFR: "border-status-red/40 bg-status-red/10 text-status-red",
  };
  const className =
    category && palette[category]
      ? palette[category]
      : "border-border bg-muted/30 text-muted-foreground";
  return (
    <div className="flex flex-col gap-1">
      <span
        className={`inline-block rounded-sm border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em] ${className}`}
      >
        {category ?? "—"}
      </span>
      {alternateRequired && (
        <span className="text-[0.6rem] text-status-yellow">Alt req&apos;d</span>
      )}
    </div>
  );
}

function RawReport({ report }: { report: WeatherReportResponse }) {
  return (
    <div>
      <p className="break-all font-mono text-[0.7rem] leading-relaxed text-foreground">
        {report.raw}
      </p>
      <p className="mt-1 text-[0.6rem] text-muted-foreground">
        {report.cache_hit ? "cached" : "fresh"} • fetched{" "}
        {formatRelative(report.parsed_at)}
      </p>
    </div>
  );
}

function formatRelative(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
