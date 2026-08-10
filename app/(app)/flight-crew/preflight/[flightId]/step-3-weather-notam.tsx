"use client";

import { useMemo, useState, useTransition } from "react";

import type {
  FlightCategory,
  FlightDetail,
  WeatherBatchResponse,
  WeatherReportResponse,
} from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { completeStepAction } from "./actions";

interface Props {
  flightId: string;
  flight: FlightDetail;
  /** Server-fetched METAR + TAF for the routing airports. Null when
   *  the weather-service was unreachable at page-load time — cards
   *  fall back to "data unavailable" copy and the ack is still
   *  required (legacy behavior: the pilot signs that they reviewed
   *  weather regardless of source, in their usual tool). */
  weather: WeatherBatchResponse | null;
}

/**
 * Step 3 — Weather + NOTAM Review (Spec 4 §"The 8 steps / 3").
 *
 * Spec gate: one acknowledgment per routing airport ("I have reviewed
 * all weather and NOTAMs for [ICAO]"). All required before Continue.
 *
 * Content per airport (M2-M-4 wire-through):
 *   - Real METAR from weather-service (raw text, flight-category
 *     pill, ceiling / visibility / wind summary, alternate-required
 *     verdict per FAR 91.169 when the current METAR trips the
 *     ceiling<2000ft OR vis<3SM threshold).
 *   - Real TAF from weather-service (raw text).
 *   - NOTAM data is not wired yet (no /weather/notam endpoint today);
 *     copy points the pilot at their usual source (ForeFlight,
 *     1800wxbrief) and the ack row explicitly names NOTAMs so the
 *     regulatory sign-off still covers them.
 *   - Cached / live badge from `cache_hit`.
 *   - Data-unavailable warning per airport when the batch endpoint
 *     returned an error for that ICAO+kind pair.
 */
export function WeatherAndNotamStep({ flightId, flight, weather }: Props) {
  const airports = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const icao of [flight.origin, flight.destination]) {
      if (icao && !seen.has(icao)) {
        seen.add(icao);
        list.push(icao);
      }
    }
    return list;
  }, [flight.origin, flight.destination]);

  // Index the batch response for O(1) lookup per (icao, kind) card.
  const byKey = useMemo(() => {
    const map = new Map<string, WeatherReportResponse>();
    if (!weather) return map;
    for (const item of weather.items) {
      map.set(`${item.icao}:${item.kind}`, item);
    }
    return map;
  }, [weather]);

  const errorsByKey = useMemo(() => {
    const map = new Map<string, string>();
    if (!weather) return map;
    for (const err of weather.errors) {
      map.set(`${err.icao}:${err.kind}`, err.detail);
    }
    return map;
  }, [weather]);

  const [acked, setAcked] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const allAcked = airports.every((icao) => acked.has(icao));
  const canSubmit = allAcked && !pending;

  const toggle = (icao: string) => {
    setAcked((prev) => {
      const next = new Set(prev);
      if (next.has(icao)) next.delete(icao);
      else next.add(icao);
      return next;
    });
  };

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await completeStepAction(flightId, 3, {
        airport_acks: airports.map((icao) => ({
          icao,
          acknowledged_at: new Date().toISOString(),
        })),
      });
      if (!result.ok) {
        setError(result.error ?? "Couldn't save — try again.");
      }
    });
  };

  const weatherServiceDown = weather === null;

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="border-b border-border px-5 py-3">
        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
          Step 3
        </p>
        <h2 className="text-base font-semibold text-foreground">
          Weather and NOTAM Review
        </h2>
      </header>

      <div className="space-y-4 px-5 py-4 text-sm">
        <p className="text-muted-foreground">
          Review the current weather and active NOTAMs for every routing
          airport. Acknowledge each one — this PILOT acknowledgment is
          separate from the dispatcher acknowledgment on the release PDF
          and creates its own audit row.
        </p>

        {weatherServiceDown && (
          <div
            role="alert"
            className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
          >
            Weather-service is unreachable — METAR / TAF cards can&rsquo;t
            render right now. Pull the data in your usual source
            (ForeFlight, 1800wxbrief) and acknowledge below.
          </div>
        )}

        <ul className="space-y-2">
          {airports.map((icao) => {
            const metar = byKey.get(`${icao}:metar`) ?? null;
            const taf = byKey.get(`${icao}:taf`) ?? null;
            const metarErr = errorsByKey.get(`${icao}:metar`) ?? null;
            const tafErr = errorsByKey.get(`${icao}:taf`) ?? null;
            const isAcked = acked.has(icao);
            return (
              <li
                key={icao}
                className={cn(
                  "rounded-lg border bg-background px-4 py-3 text-xs transition-colors",
                  isAcked
                    ? "border-status-green/40 bg-status-green/5"
                    : "border-border",
                )}
              >
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-mono text-base font-bold text-foreground">
                      {icao}
                    </span>
                    {metar?.flight_category && (
                      <FlightCategoryPill category={metar.flight_category} />
                    )}
                    {metar?.alternate_required && (
                      <span
                        className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-status-yellow"
                        title="FAR 91.169: current METAR below alternate-required threshold (ceiling <2000 ft OR vis <3 SM)"
                      >
                        Alternate required
                      </span>
                    )}
                    {metar && (
                      <span className="text-[0.6rem] text-muted-foreground">
                        {metar.cache_hit ? "cached" : "live"} · fetched{" "}
                        {formatFetchedAt(metar.parsed_at)}
                      </span>
                    )}
                  </div>
                  {isAcked && (
                    <span className="rounded-md border border-status-green/40 bg-status-green/10 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-status-green">
                      Acknowledged
                    </span>
                  )}
                </div>

                {metar ? (
                  <MetarSummary metar={metar} />
                ) : metarErr ? (
                  <WeatherError kind="METAR" detail={metarErr} />
                ) : weatherServiceDown ? null : (
                  <WeatherError kind="METAR" detail="No METAR returned." />
                )}

                {taf ? (
                  <TafBlock raw={taf.raw} />
                ) : tafErr ? (
                  <WeatherError kind="TAF" detail={tafErr} />
                ) : weatherServiceDown ? null : (
                  <WeatherError kind="TAF" detail="No TAF returned." />
                )}

                <p className="mt-2 text-[0.65rem] text-muted-foreground">
                  NOTAM data is not wired into this view yet — pull
                  active NOTAMs for {icao} in your usual source
                  (ForeFlight, 1800wxbrief) and confirm below.
                </p>

                <label className="mt-3 flex cursor-pointer items-start gap-2 text-foreground">
                  <input
                    type="checkbox"
                    checked={isAcked}
                    onChange={() => toggle(icao)}
                    className="mt-0.5 h-4 w-4 cursor-pointer accent-status-blue"
                  />
                  <span>
                    I have reviewed all weather and NOTAMs for{" "}
                    <span className="font-mono">{icao}</span>.
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="inline-flex w-full items-center justify-center rounded-md bg-status-blue px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Continue to Step 4 →"}
        </button>

        {error && (
          <p role="alert" className="text-xs text-status-red">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

function MetarSummary({ metar }: { metar: WeatherReportResponse }) {
  return (
    <div className="mt-1 space-y-2">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[0.65rem] text-muted-foreground sm:grid-cols-4">
        <Stat label="Ceiling" value={fmtCeiling(metar.ceiling_ft)} />
        <Stat label="Visibility" value={fmtVis(metar.visibility_sm)} />
        <Stat label="Wind" value={fmtWind(metar)} />
        <Stat
          label="Temp / Dew"
          value={
            metar.temp_c != null && metar.dewpoint_c != null
              ? `${Math.round(metar.temp_c)}°C / ${Math.round(metar.dewpoint_c)}°C`
              : "—"
          }
        />
      </div>
      <details className="rounded border border-border/60 bg-muted/[0.05] px-2 py-1">
        <summary className="cursor-pointer text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
          Raw METAR
        </summary>
        <p className="mt-1 whitespace-pre-wrap break-words font-mono text-[0.7rem] text-foreground">
          {metar.raw}
        </p>
      </details>
    </div>
  );
}

function TafBlock({ raw }: { raw: string }) {
  return (
    <details className="mt-2 rounded border border-border/60 bg-muted/[0.05] px-2 py-1">
      <summary className="cursor-pointer text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
        Raw TAF
      </summary>
      <p className="mt-1 whitespace-pre-wrap break-words font-mono text-[0.7rem] text-foreground">
        {raw}
      </p>
    </details>
  );
}

function WeatherError({ kind, detail }: { kind: string; detail: string }) {
  return (
    <div
      role="alert"
      className="mt-2 rounded border border-status-yellow/40 bg-status-yellow/10 px-2 py-1 text-[0.65rem] text-status-yellow"
    >
      {kind} unavailable — {detail}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[0.6rem] uppercase tracking-wider text-muted-foreground/70">
        {label}
      </div>
      <div className="font-mono text-foreground">{value}</div>
    </div>
  );
}

function FlightCategoryPill({ category }: { category: FlightCategory }) {
  const cls =
    category === "VFR"
      ? "border-status-green/40 bg-status-green/10 text-status-green"
      : category === "MVFR"
        ? "border-status-blue/40 bg-status-blue/10 text-status-blue"
        : category === "IFR"
          ? "border-status-yellow/40 bg-status-yellow/10 text-status-yellow"
          : "border-status-red/40 bg-status-red/10 text-status-red";
  return (
    <span
      className={cn(
        "rounded-md border px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.06em]",
        cls,
      )}
    >
      {category}
    </span>
  );
}

function fmtCeiling(ft: number | null): string {
  if (ft === null) return "Clear";
  return `${ft.toLocaleString()} ft`;
}

function fmtVis(sm: number | null): string {
  if (sm === null) return "—";
  return `${sm.toFixed(1)} SM`;
}

function fmtWind(m: WeatherReportResponse): string {
  if (m.wind_calm) return "Calm";
  if (m.wind_speed_kt === null) return "—";
  const dir = m.wind_variable
    ? "VRB"
    : m.wind_direction_deg !== null
      ? `${String(m.wind_direction_deg).padStart(3, "0")}°`
      : "—";
  const speed = `${m.wind_speed_kt} kt`;
  const gust = m.wind_gust_kt ? ` G${m.wind_gust_kt}` : "";
  return `${dir} ${speed}${gust}`;
}

function formatFetchedAt(iso: string): string {
  const ageMs = Date.now() - new Date(iso).getTime();
  if (ageMs < 60_000) return "just now";
  const mins = Math.round(ageMs / 60_000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs} h ago`;
}
