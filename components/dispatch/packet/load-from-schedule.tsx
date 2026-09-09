"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";

import { SectionPanel } from "./section-panel";
import type { FlightListItem } from "@/lib/api/types";

/**
 * "Load from Schedule" — pick the day, then the flight.
 *
 * Client report, 9 September:
 *
 *   I've been trying to cruise around in the system but I'm mostly
 *   unsuccessful in building flight, assigning flights to pilots,
 *   viewing flights as pilot etc.
 *
 * This panel was a large part of why. It listed only the flights
 * departing *today*, with no way to change the day, so a flight built
 * for tomorrow — which is most of them, because dispatch plans ahead —
 * could not be selected here at all. No packet, so no crew assignment
 * and no release. The flight existed, showed on the schedule, and was
 * simply unreachable from the desk that has to work it.
 *
 * Worse on a quiet day: with no flights the whole panel returned null,
 * so the dispatcher got a packet with no flight selector at all and
 * nothing to change the date with. The emptier the day, the less there
 * was to work with.
 *
 * So the day is now part of the panel and always rendered, even when
 * the day is empty — an empty day is a normal thing to be looking at,
 * usually on the way to somewhere else.
 *
 * Date arithmetic is UTC throughout: `T00:00:00Z` on parse and
 * `setUTCDate` to step. Doing it in local time is what made the fleet
 * board's arrows skip two days at a time west of Greenwich (8/24), and
 * the same trap is here.
 *
 * Changing the day clears the selected flight rather than carrying it.
 * The selection is a flight on the day you were looking at; keeping it
 * while the list underneath changes would show a packet for a flight
 * that is not in the list above it.
 */
export function LoadFromSchedule({
  flights,
  selectedFlightId,
  date,
  children,
}: {
  flights: FlightListItem[];
  selectedFlightId?: string | null;
  /** The day being shown, `YYYY-MM-DD` UTC. */
  date: string;
  /** Slot for the SelectedFlightSummary rows that render below the dropdown
   * when a flight is loaded. Pre-rendered server-side and passed in. */
  children?: ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const goToDate = (next: string) => {
    if (!next) return;
    startTransition(() => {
      router.push(`/dispatch/?date=${next}`);
    });
  };

  const shiftDays = (days: number) => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    goToDate(d.toISOString().slice(0, 10));
  };

  return (
    <SectionPanel title="Load from Schedule" accent="blue">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <label
          htmlFor="load-from-schedule-select"
          className="block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
        >
          Scheduled Flight
        </label>

        <div className="flex items-center gap-1">
          {isPending && (
            <span
              role="status"
              aria-live="polite"
              className="mr-1 flex items-center gap-1 text-[0.65rem] font-medium text-status-blue"
            >
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              Loading…
            </span>
          )}
          <button
            type="button"
            onClick={() => shiftDays(-1)}
            disabled={isPending}
            aria-label="Previous day"
            className="rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold text-foreground hover:bg-muted/40 disabled:opacity-60"
          >
            ←
          </button>
          <input
            type="date"
            aria-label="Schedule date (UTC)"
            value={date}
            onChange={(e) => goToDate(e.target.value)}
            disabled={isPending}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-status-blue focus:outline-none disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => shiftDays(1)}
            disabled={isPending}
            aria-label="Next day"
            className="rounded-md border border-border bg-card px-2 py-1 text-xs font-semibold text-foreground hover:bg-muted/40 disabled:opacity-60"
          >
            →
          </button>
        </div>
      </div>

      {flights.length === 0 ? (
        // An empty day is a normal thing to be looking at. Say which day
        // is empty — without the date this reads as "the system has no
        // flights", which is a different and much more alarming claim —
        // and offer the two ways on: another day, or build one.
        <div className="rounded-lg border border-border bg-background px-3 py-3 text-[0.8125rem] text-muted-foreground">
          <p>
            No flights scheduled for{" "}
            <span className="font-semibold text-foreground">{date}</span> (UTC).
          </p>
          <p className="mt-1">
            Step to another day above, or{" "}
            <Link
              href="/flight-following/new"
              className="font-semibold text-status-blue hover:underline"
            >
              build a flight for this one →
            </Link>
          </p>
        </div>
      ) : (
        <select
          id="load-from-schedule-select"
          value={selectedFlightId ?? ""}
          onChange={(e) => {
            const id = e.target.value;
            startTransition(() => {
              router.push(
                id ? `/dispatch/?date=${date}&flight=${id}` : `/dispatch/?date=${date}`,
              );
            });
          }}
          disabled={isPending}
          aria-busy={isPending}
          className="flex h-9 w-full rounded-lg border border-border bg-background px-3 py-2 text-[0.8125rem] focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-wait disabled:opacity-70"
        >
          <option value="">— enter manually or select a flight —</option>
          {flights.map((f) => {
            const dep = f.scheduled_departure_at.slice(0, 10);
            return (
              <option key={f.id} value={f.id}>
                {dep} · {f.flight_number} · {f.origin} → {f.destination} ·{" "}
                {f.aircraft.tail_number}
              </option>
            );
          })}
        </select>
      )}

      <div
        aria-busy={isPending}
        className={
          "transition-opacity duration-150 " +
          (isPending ? "pointer-events-none opacity-60" : "")
        }
      >
        {children}
      </div>
    </SectionPanel>
  );
}
