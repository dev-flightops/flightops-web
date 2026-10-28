"use client";

import { useEffect, useState } from "react";

import { StatusMark } from "@/components/ff/status-mark";
import { localClock, type ZoneTable, zoneFor } from "@/lib/format/local-time";
import type { LegState, PlacedLeg } from "@/lib/schedule/day-legs";

import { FlightPanel, type PanelFlight, STATE_LABEL, STATE_TONE } from "./flight-panel";

export interface DayColumn {
  id: string;
  tail: string;
  model: string | null;
  grounded: string | null;
  legs: PlacedLeg[];
}

/** One hour of the day, in pixels. */
const HOUR_PX = 64;
const PX = HOUR_PX / 60;

const EDGE: Record<LegState, string> = {
  planned: "border-l-status-gray",
  released: "border-l-status-blue",
  airborne: "border-l-status-orange",
  completed: "border-l-status-green",
  cancelled: "border-l-status-red",
};

const FILL: Record<LegState, string> = {
  planned: "bg-card",
  released: "bg-status-blue/10",
  airborne: "bg-status-orange/10",
  completed: "bg-status-green/10",
  cancelled: "bg-status-red/10 line-through",
};

/**
 * The day by aircraft (#139): a column per aircraft, the company's day
 * running down, a block per leg at its local times. The client's own
 * scheduling system lays a day out this way and opens a flight from its
 * block; a block here opens the flight's panel on that leg.
 */
export function AircraftDay({
  columns,
  start,
  end,
  zone,
  zones,
  nowMinute,
}: {
  columns: DayColumn[];
  /** The first and last hour shown, local to `zone`. */
  start: number;
  end: number;
  /** The company's zone: the day's hours. */
  zone: string;
  zones: ZoneTable;
  /** Minutes into the day now, when the day is today; else null. */
  nowMinute: number | null;
}) {
  const [open, setOpen] = useState<{ flight: PanelFlight; leg: number } | null>(null);
  const now = useNow(nowMinute);
  const hours = Array.from({ length: end - start }, (_, i) => start + i);
  const height = (end - start) * HOUR_PX;
  const nowTop = now === null ? null : (now - start * 60) * PX;
  const showNow = nowTop !== null && nowTop >= 0 && nowTop <= height;

  return (
    <section aria-label="Flights by aircraft">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        {(Object.keys(STATE_LABEL) as LegState[]).map((s) => (
          <StatusMark key={s} label={STATE_LABEL[s]} tone={STATE_TONE[s]} />
        ))}
        <span className="text-xs text-muted-foreground">Times are {zoneLabel(zone)}. Open a leg for its passengers, freight and weight.</span>
      </div>
      <div className="overflow-x-auto border border-border bg-card">
        <div
          className="grid min-w-full"
          style={{ gridTemplateColumns: `3.5rem repeat(${Math.max(columns.length, 1)}, minmax(9.5rem, 1fr))` }}
        >
          <div className="sticky left-0 z-20 border-b border-r border-border bg-card" />
          {columns.map((c) => (
            <div key={c.id} className="border-b border-l border-border px-2 py-2 text-center">
              <div className="font-mono text-sm font-semibold text-foreground">{c.tail}</div>
              <div className="truncate text-[0.7rem] text-muted-foreground">{c.model ?? " "}</div>
              {c.grounded ? <StatusMark label={`Grounded · ${c.grounded}`} tone="red" className="mt-1" /> : null}
            </div>
          ))}
          {columns.length === 0 ? (
            <div className="border-b border-l border-border px-3 py-2 text-sm text-muted-foreground">No aircraft to show.</div>
          ) : null}

          <div className="sticky left-0 z-20 border-r border-border bg-card" style={{ height }}>
            <div className="relative h-full">
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute right-1.5 -translate-y-1/2 font-mono text-[0.68rem] text-muted-foreground"
                  style={{ top: (h - start) * HOUR_PX }}
                >
                  {h === start ? "" : `${String(h).padStart(2, "0")}:00`}
                </div>
              ))}
              {showNow ? (
                <div className="absolute right-1 -translate-y-1/2 text-[0.62rem] font-bold uppercase text-status-orange" style={{ top: nowTop! }}>
                  Now
                </div>
              ) : null}
            </div>
          </div>
          {columns.map((c) => (
            <div key={c.id} role="group" aria-label={`${c.tail}${c.grounded ? `, grounded: ${c.grounded}` : ""}`} className="relative border-l border-border" style={{ height }}>
              {hours.slice(1).map((h) => (
                <div key={h} aria-hidden className="absolute inset-x-0 border-t border-border" style={{ top: (h - start) * HOUR_PX }} />
              ))}
              {c.grounded ? <div aria-hidden className="absolute inset-0 bg-status-red/10" /> : null}
              {showNow ? <div aria-hidden className="absolute inset-x-0 z-10 border-t-2 border-status-orange" style={{ top: nowTop! }} /> : null}
              {c.legs.map((leg) => (
                <LegBlock
                  key={`${leg.flightId}:${leg.index}`}
                  leg={leg}
                  top={(leg.top) * PX}
                  height={leg.height * PX}
                  zone={zoneFor(zones, leg.origin)}
                  onOpen={() =>
                    setOpen({
                      flight: { id: leg.flightId, flightNumber: leg.flightNumber, stops: leg.stops, tail: leg.tail, state: leg.state },
                      leg: leg.index - 1,
                    })
                  }
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      {open ? (
        <FlightPanel
          key={`${open.flight.id}:${open.leg}`}
          flight={open.flight}
          leg={open.leg}
          zones={zones}
          open
          onOpenChange={(next) => {
            if (!next) setOpen(null);
          }}
        />
      ) : null}
    </section>
  );
}

function LegBlock({
  leg,
  top,
  height,
  zone,
  onOpen,
}: {
  leg: PlacedLeg;
  top: number;
  height: number;
  zone: string;
  onOpen: () => void;
}) {
  const times = `${localClock(leg.departsAt, zone).slice(0, 5)}–${localClock(leg.arrivesAt, zone).slice(0, 5)}`;
  const seats = leg.held !== null && leg.seats ? `${leg.held}/${leg.seats}` : null;
  const width = 100 / leg.lanes;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${leg.label}, ${leg.origin} to ${leg.destination}, ${times}, ${STATE_LABEL[leg.state]}${seats ? `, ${leg.held} of ${leg.seats} seats booked` : ""}`}
      className={`absolute z-10 overflow-hidden border border-border border-l-[3px] ${EDGE[leg.state]} ${FILL[leg.state]} px-1.5 py-0.5 text-left text-[0.7rem] leading-tight text-foreground transition-colors hover:border-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary`}
      style={{ top, height, left: `calc(${leg.lane * width}% + 2px)`, width: `calc(${width}% - 4px)` }}
    >
      <span className="flex items-baseline justify-between gap-1">
        <span className="truncate">
          <span className="font-mono font-semibold">{leg.label}</span>{" "}
          <span className="font-mono">
            {leg.origin} → {leg.destination}
          </span>
        </span>
        {seats && height < 34 ? <span className="shrink-0 font-mono">{seats}</span> : null}
      </span>
      {height >= 34 ? (
        <span className="flex items-baseline justify-between gap-1 text-muted-foreground">
          <span className="font-mono">{times}</span>
          {seats ? <span className="font-mono text-foreground">{seats}</span> : null}
        </span>
      ) : null}
    </button>
  );
}

/** The minute of the day, moving on once a minute while the page is open.
 *  Taken from the page each time: stepping to another day keeps this
 *  component, and a kept value drew today's line on other days. */
function useNow(initial: number | null): number | null {
  const [ticks, setTicks] = useState(0);
  useEffect(() => {
    setTicks(0);
    if (initial === null) return;
    const timer = setInterval(() => setTicks((t) => t + 1), 60_000);
    return () => clearInterval(timer);
  }, [initial]);
  return initial === null ? null : initial + ticks;
}

function zoneLabel(zone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "short" }).formatToParts(new Date());
  return parts.find((p) => p.type === "timeZoneName")?.value ?? zone;
}
