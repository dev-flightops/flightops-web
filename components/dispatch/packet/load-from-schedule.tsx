"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";

import { DEMO_PIC_NAME } from "./demo-placeholders";
import { SectionPanel } from "./section-panel";
import type { FlightListItem } from "@/lib/api/types";

/**
 * "Load from Schedule" dropdown — mirrors the legacy
 * `templates/dispatch/form.html` flight selector.
 *
 * Selecting a flight updates the page URL to `/dispatch/?flight=<id>`
 * (the trailing slash is the global config). The server component
 * re-renders the page with the chosen flight's data pre-populated in
 * the Flight Details panel + summary rows below this dropdown.
 *
 * Smoothness: the navigation runs inside `startTransition` so React
 * keeps the previous render on screen until the new server data is
 * ready (no white-flash, no scroll jump). While pending we surface a
 * small "Loading…" chip next to the label, dim the summary children,
 * and disable the select to prevent racing changes. Without this the
 * 100-300ms backend round-trip looks like a frozen page.
 *
 * Browser bookmark behavior: the URL captures the selection, so
 * sharing the link preserves it.
 */
export function LoadFromSchedule({
  flights,
  selectedFlightId,
  children,
}: {
  flights: FlightListItem[];
  selectedFlightId?: string | null;
  /** Slot for the SelectedFlightSummary rows that render below the dropdown
   * when a flight is loaded. Pre-rendered server-side and passed in. */
  children?: ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Legacy parity: with no scheduled flights, the panel disappears
  // entirely and the dispatcher goes straight to direct entry in the
  // Flight Details section below. Prior copy said "Re-seed via docker
  // compose..." which is a dev-only affordance leaking into a client
  // demo surface.
  if (flights.length === 0) {
    return null;
  }

  return (
    <SectionPanel title="Load from Schedule" accent="blue">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label
          htmlFor="load-from-schedule-select"
          className="block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
        >
          Scheduled Flight
        </label>
        {isPending && (
          <span
            role="status"
            aria-live="polite"
            className="flex items-center gap-1 text-[0.65rem] font-medium text-status-blue"
          >
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            Loading…
          </span>
        )}
      </div>
      <select
        id="load-from-schedule-select"
        value={selectedFlightId ?? ""}
        onChange={(e) => {
          const id = e.target.value;
          startTransition(() => {
            router.push(id ? `/dispatch/?flight=${id}` : "/dispatch/");
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
              {f.aircraft.tail_number} · {DEMO_PIC_NAME}
            </option>
          );
        })}
      </select>

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
