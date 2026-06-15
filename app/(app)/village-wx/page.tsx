import { AddAirportDialog } from "@/components/village-wx/add-airport-dialog";
import { AddReportDialog } from "@/components/village-wx/add-report-dialog";
import { ApiError } from "@/lib/api/client";
import type {
  FlightCategory,
  VillageBoardRow,
  VillageWeatherReportResponse,
} from "@/lib/api/types";
import { getVillageBoard, listVillageAirports } from "@/lib/api/weather";

import { AutoRefresh } from "./auto-refresh";
import { DensityToggle } from "./density-toggle";

/**
 * /village-wx — Village Weather Board (M2-G-village-wx-redesign).
 *
 * User-submitted weather observations for the rural strips AWC doesn't
 * publish METAR for. The board groups airports by region (free text on
 * the airport row) and pairs each with its most recent report. Stale
 * tinting: > 2hr yellow, > 4hr red. Auto-refreshes every 5 minutes via
 * the AutoRefresh client island so the age + colors evolve without a
 * manual reload.
 *
 * Two write paths: + Add Report (file an observation) and + Add Airport
 * (extend the directory). Both are dialogs hitting weather-service.
 */

const STALE_YELLOW_MS = 2 * 60 * 60 * 1000;
const STALE_RED_MS = 4 * 60 * 60 * 1000;
const UNGROUPED_LABEL = "Unassigned";

export default async function VillageWxPage({
  searchParams,
}: {
  searchParams: Promise<{ density?: string }>;
}) {
  const { density } = await searchParams;
  const view: "compact" | "expanded" =
    density === "expanded" ? "expanded" : "compact";

  let board: VillageBoardRow[] = [];
  let activeAirports: VillageBoardRow["airport"][] = [];
  let loadError: string | null = null;

  try {
    const [boardResp, airportsResp] = await Promise.all([
      getVillageBoard(),
      listVillageAirports(),
    ]);
    board = boardResp.items;
    activeAirports = airportsResp.items;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Village board unavailable. Try refreshing in a moment.";
  }

  const now = Date.now();
  const grouped = groupByRegion(board);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <AutoRefresh />

      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Village Weather Board
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Field conditions for rural airports · Auto-refreshes every 5
            minutes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AddReportDialog airports={activeAirports} />
          <AddAirportDialog />
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-[0.7rem] text-muted-foreground">
          <CategoryLegend />
          <span>
            Stale:{" "}
            <span className="font-semibold text-status-yellow">&gt;2hr</span>
            {" · "}
            <span className="font-semibold text-status-red">&gt;4hr</span>
          </span>
        </div>
        <DensityToggle active={view} />
      </div>

      {loadError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
        >
          {loadError}
        </div>
      )}

      {!loadError && board.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-card/40 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No village airports configured. Add one to get started.
          </p>
          <p className="mt-2 text-xs text-muted-foreground/70">
            (Village airports are the strips AWC doesn&apos;t publish METAR
            for — Bethel, etc.)
          </p>
        </div>
      )}

      {grouped.map(([region, rows]) => (
        <section key={region} className="mb-6">
          <h2 className="mb-2 text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {region}
          </h2>
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.airport.id}>
                <ReportCard row={row} view={view} now={now} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// ---------- Card -----------------------------------------------------------


function ReportCard({
  row,
  view,
  now,
}: {
  row: VillageBoardRow;
  view: "compact" | "expanded";
  now: number;
}) {
  const { airport, latest_report: r } = row;
  const accent = categoryAccent(r?.flight_category ?? null);
  const stale = r ? staleness(new Date(r.reported_at).getTime(), now) : null;

  const ageLabel = r
    ? formatAge(now - new Date(r.reported_at).getTime())
    : null;
  const reporterName =
    r?.reported_by?.full_name ?? r?.reported_by_name ?? null;

  return (
    <article
      className={`overflow-hidden rounded-md border bg-card ${accent.border}`}
    >
      <div className={`border-l-4 px-4 py-3 ${accent.leftBorder}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className={`inline-block h-2 w-2 rounded-full ${accent.dot}`}
              />
              <h3 className="text-sm font-semibold text-foreground">
                {airport.name}
              </h3>
              <code className="font-mono text-[0.65rem] text-muted-foreground">
                {airport.icao}
              </code>
            </div>
            {r ? (
              <Conditions report={r} view={view} />
            ) : (
              <p className="mt-1 text-[0.75rem] text-muted-foreground/80">
                No report yet — file the first observation.
              </p>
            )}
          </div>
          {r?.flight_category && (
            <CategoryBadge category={r.flight_category} />
          )}
        </div>

        {r && (
          <footer
            className={`mt-2 text-[0.7rem] ${
              stale === "red"
                ? "text-status-red"
                : stale === "yellow"
                  ? "text-status-yellow"
                  : "text-muted-foreground"
            }`}
          >
            {formatStamp(r.reported_at)}
            {reporterName ? ` by ${reporterName}` : ""}
            {ageLabel ? ` · ${ageLabel} ago` : ""}
            {stale === "red" && " — STALE"}
            {stale === "yellow" && " — aging"}
          </footer>
        )}
      </div>
    </article>
  );
}

function Conditions({
  report,
  view,
}: {
  report: VillageWeatherReportResponse;
  view: "compact" | "expanded";
}) {
  const skyLine = formatSky(report);
  const windLine = formatWind(report);
  const altPiece = report.altimeter_in_hg
    ? `${report.altimeter_in_hg.toFixed(2)}"`
    : null;

  if (view === "compact") {
    const left = skyLine ?? "—";
    const right = [windLine, altPiece].filter(Boolean).join(" · ");
    return (
      <p className="mt-1 text-[0.85rem] text-foreground">
        {left}
        {right && (
          <span className="ml-2 text-muted-foreground">{right}</span>
        )}
      </p>
    );
  }

  return (
    <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[0.8rem]">
      {skyLine && (
        <Row label="Sky" value={skyLine} />
      )}
      {windLine && <Row label="Wind" value={windLine} />}
      {altPiece && <Row label="Altimeter" value={altPiece} />}
      {report.temperature_c != null && (
        <Row label="Temp" value={`${report.temperature_c}°C`} />
      )}
      {report.notes && (
        <Row label="Notes" value={report.notes} span2 />
      )}
    </dl>
  );
}

function Row({
  label,
  value,
  span2,
}: {
  label: string;
  value: string;
  span2?: boolean;
}) {
  return (
    <div className={span2 ? "col-span-2 flex gap-2" : "flex gap-2"}>
      <dt className="shrink-0 font-semibold uppercase tracking-[0.06em] text-[0.65rem] text-muted-foreground">
        {label}
      </dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}

// ---------- Category bits --------------------------------------------------

function CategoryLegend() {
  return (
    <div className="flex items-center gap-3">
      {(["VFR", "MVFR", "IFR", "LIFR"] as const).map((c) => {
        const a = categoryAccent(c);
        return (
          <span key={c} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={`inline-block h-2 w-2 rounded-full ${a.dot}`}
            />
            <span className="font-semibold text-foreground">{c}</span>
          </span>
        );
      })}
    </div>
  );
}

function CategoryBadge({ category }: { category: FlightCategory }) {
  const a = categoryAccent(category);
  return (
    <span
      className={`shrink-0 rounded-sm border px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] ${a.badge}`}
    >
      {category}
    </span>
  );
}

function categoryAccent(category: FlightCategory | null) {
  switch (category) {
    case "VFR":
      return {
        leftBorder: "border-l-status-green",
        border: "border-border",
        dot: "bg-status-green",
        badge:
          "border-status-green/40 bg-status-green/10 text-status-green",
      };
    case "MVFR":
      return {
        leftBorder: "border-l-status-blue",
        border: "border-border",
        dot: "bg-status-blue",
        badge:
          "border-status-blue/40 bg-status-blue/10 text-status-blue",
      };
    case "IFR":
      return {
        leftBorder: "border-l-status-yellow",
        border: "border-border",
        dot: "bg-status-yellow",
        badge:
          "border-status-yellow/40 bg-status-yellow/10 text-status-yellow",
      };
    case "LIFR":
      return {
        leftBorder: "border-l-status-red",
        border: "border-border",
        dot: "bg-status-red",
        badge: "border-status-red/40 bg-status-red/10 text-status-red",
      };
    default:
      return {
        leftBorder: "border-l-border",
        border: "border-border",
        dot: "bg-muted-foreground/50",
        badge: "border-border bg-muted/30 text-muted-foreground",
      };
  }
}

// ---------- Formatting helpers --------------------------------------------

function formatSky(r: VillageWeatherReportResponse): string | null {
  const cloud = r.cloud_cover;
  const ceiling =
    r.ceiling_ft != null ? `${r.ceiling_ft.toLocaleString()}ft` : null;
  const vis = r.visibility_sm != null ? formatVis(r.visibility_sm) : null;

  const left = [cloud, ceiling].filter(Boolean).join(" ");
  const right = vis ? `Vis ${vis}` : null;
  const combined = [left || null, right].filter(Boolean).join(" · ");
  return combined || null;
}

function formatVis(sm: number): string {
  if (sm < 0.25) return "< 1/4SM";
  if (sm < 1) {
    // Render as a fraction the dispatcher recognizes.
    const frac = Math.round(sm * 4) / 4;
    if (frac === 0.25) return "1/4SM";
    if (frac === 0.5) return "1/2SM";
    if (frac === 0.75) return "3/4SM";
  }
  return `${sm}SM`;
}

function formatWind(r: VillageWeatherReportResponse): string | null {
  if (r.wind_speed_kt == null && r.wind_dir_deg == null) return null;
  if (r.wind_speed_kt === 0) return "Calm";
  const dir =
    r.wind_dir_deg != null
      ? String(r.wind_dir_deg).padStart(3, "0") + "°"
      : "VRB";
  const speed = r.wind_speed_kt != null ? `${r.wind_speed_kt}kt` : "";
  const gust = r.wind_gust_kt ? `G${r.wind_gust_kt}` : "";
  return `Wind ${dir}/${speed}${gust}`;
}

function formatStamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatAge(ms: number): string {
  if (ms < 60_000) return "<1m";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(hours < 10 ? 1 : 0)}h`;
  const days = hours / 24;
  return `${days.toFixed(days < 10 ? 1 : 0)}d`;
}

function staleness(reportedAtMs: number, nowMs: number): "yellow" | "red" | null {
  const age = nowMs - reportedAtMs;
  if (age > STALE_RED_MS) return "red";
  if (age > STALE_YELLOW_MS) return "yellow";
  return null;
}

function groupByRegion(rows: VillageBoardRow[]): [string, VillageBoardRow[]][] {
  const buckets = new Map<string, VillageBoardRow[]>();
  for (const row of rows) {
    const key = row.airport.region?.trim() || UNGROUPED_LABEL;
    const bucket = buckets.get(key) ?? [];
    bucket.push(row);
    buckets.set(key, bucket);
  }
  // Stable alphabetical, "Unassigned" last so named regions surface first.
  return Array.from(buckets.entries()).sort(([a], [b]) => {
    if (a === UNGROUPED_LABEL) return 1;
    if (b === UNGROUPED_LABEL) return -1;
    return a.localeCompare(b);
  });
}

// Force this page to re-fetch on every navigation; the AutoRefresh
// island handles in-tab interval refreshes. Caching would make staleness
// indicators wrong.
export const dynamic = "force-dynamic";
