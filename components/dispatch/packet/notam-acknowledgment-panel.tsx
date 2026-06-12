"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { SectionPanel } from "./section-panel";

/**
 * NOTAM Acknowledgment panel — manual bridge until M2-M-4 ships the
 * real FAA NOTAM proxy.
 *
 * The formal spec mandates a NOTAM section per routing ICAO with a
 * per-airport "Review and Acknowledge" checkbox that gates Generate
 * PDF. The real-NOTAM source (FAA proxy via weather-service) isn't
 * built yet — so the dispatcher reviews NOTAMs out-of-band (jeppesen /
 * 1800wxbrief / Foreflight) and checks the box here to record that the
 * brief happened. Acknowledgment state lives in the URL
 * (`?notams_acked=PANC,PABE`) so it's:
 *
 *   - shareable: dispatcher can hand the URL to a supervisor with
 *     ack state intact
 *   - cheap to persist: no DB table needed for the manual bridge
 *   - composable with the multi-condition Generate-PDF gate downstream
 *
 * When M2-M-4 lands the panel grows: real NOTAM list per airport with
 * color-coded categories (red runway/airspace, yellow equipment/lighting,
 * blue general). The checkbox semantics stay the same so this UI stays
 * the surface contract.
 */
export function NotamAcknowledgmentPanel({
  icaos,
  ackedFromUrl,
}: {
  icaos: string[];
  ackedFromUrl: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  if (icaos.length === 0) {
    return (
      <SectionPanel
        title="NOTAM Acknowledgment"
        titleAction={
          <span
            className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-status-yellow"
            title="Real NOTAM list lands when the FAA proxy ships (M2-M-4). Today this is a manual acknowledgment that you have reviewed NOTAMs out-of-band."
          >
            Manual ack · proxy M2-M-4
          </span>
        }
      >
        <p className="text-xs text-muted-foreground">
          Pick a flight or enter a routing to acknowledge NOTAMs per stop.
        </p>
      </SectionPanel>
    );
  }

  // Filter ackedFromUrl to only contain ICAOs that are still in the route
  // — if dispatcher removes a stop, its ack should disappear too.
  const acked = new Set(
    ackedFromUrl
      .map((s) => s.trim().toUpperCase())
      .filter((s) => icaos.includes(s)),
  );

  const updateUrl = (next: Set<string>) => {
    const search = new URLSearchParams(params?.toString() ?? "");
    if (next.size === 0) {
      search.delete("notams_acked");
    } else {
      search.set(
        "notams_acked",
        [...next].sort().join(","),
      );
    }
    const qs = search.toString();
    startTransition(() => {
      router.replace(`/dispatch/${qs ? `?${qs}` : ""}`, { scroll: false });
    });
  };

  const toggle = (icao: string) => {
    const next = new Set(acked);
    if (next.has(icao)) next.delete(icao);
    else next.add(icao);
    updateUrl(next);
  };

  const ackAll = () => updateUrl(new Set(icaos));
  const clearAll = () => updateUrl(new Set());

  const allAcked = icaos.every((i) => acked.has(i));

  return (
    <SectionPanel
      title="NOTAM Acknowledgment"
      titleAction={
        <div className="flex items-center gap-2">
          {allAcked ? (
            <span className="rounded-md border border-status-green/40 bg-status-green/10 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-status-green">
              {icaos.length}/{icaos.length} acknowledged
            </span>
          ) : (
            <span className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-status-yellow">
              {acked.size}/{icaos.length} acknowledged
            </span>
          )}
        </div>
      }
    >
      <p className="mb-3 text-xs text-muted-foreground">
        Review NOTAMs for each stop in your usual source (1800wxbrief,
        ForeFlight, etc.) and check the box to confirm. All boxes must be
        checked before Generate PDF unlocks.
      </p>

      <ul className="space-y-1.5">
        {icaos.map((icao) => {
          const isAcked = acked.has(icao);
          return (
            <li key={icao}>
              <label
                className={`flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors ${
                  isAcked
                    ? "border-status-green/40 bg-status-green/5"
                    : "border-border bg-card/40 hover:border-status-blue/40"
                }`}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isAcked}
                    onChange={() => toggle(icao)}
                    disabled={isPending}
                    aria-label={`Acknowledge NOTAMs for ${icao}`}
                    className="h-4 w-4 cursor-pointer accent-status-blue"
                  />
                  <span className="font-mono font-semibold">{icao}</span>
                  <span className="text-xs text-muted-foreground">
                    I have reviewed all NOTAMs for {icao} and briefed the PIC
                  </span>
                </span>
                {isAcked && (
                  <span className="text-xs font-semibold text-status-green">
                    ✓
                  </span>
                )}
              </label>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {acked.size > 0 && (
          <button
            type="button"
            onClick={clearAll}
            disabled={isPending}
            className="text-[0.7rem] font-semibold text-status-red hover:underline disabled:opacity-60"
          >
            Clear all
          </button>
        )}
        {!allAcked && (
          <button
            type="button"
            onClick={ackAll}
            disabled={isPending}
            className="rounded-md border border-status-blue bg-status-blue/15 px-3 py-1 text-[0.7rem] font-semibold text-status-blue hover:bg-status-blue/20 disabled:opacity-60"
          >
            Acknowledge all
          </button>
        )}
      </div>
    </SectionPanel>
  );
}

// `parseAckedIcaos` lives in ./notam-acks (a server-safe module) so the
// dispatch server component can import it without dragging the
// "use client" panel into the server bundle.
