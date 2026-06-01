"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

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

  if (flights.length === 0) {
    return (
      <SectionPanel title="Load from Schedule" accent="blue">
        <p className="text-xs text-muted-foreground">
          No scheduled flights for today. Re-seed via{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.7rem]">
            docker compose run --rm seed
          </code>{" "}
          to refresh the demo.
        </p>
      </SectionPanel>
    );
  }

  return (
    <SectionPanel title="Load from Schedule" accent="blue">
      <label
        htmlFor="load-from-schedule-select"
        className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
      >
        Scheduled Flight
      </label>
      <select
        id="load-from-schedule-select"
        value={selectedFlightId ?? ""}
        onChange={(e) => {
          const id = e.target.value;
          router.push(id ? `/dispatch/?flight=${id}` : "/dispatch/");
        }}
        className="flex h-9 w-full rounded-lg border border-border bg-background px-3 py-2 text-[0.8125rem] focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
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

      {children}
    </SectionPanel>
  );
}
