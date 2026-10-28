"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useState, useTransition } from "react";

import { buttonOutline, buttonSolid, linkCaps, tab, tabList } from "@/components/ff/controls";
import { LoadFailedNotice } from "@/components/ff/setup-notice";
import { StatusMark, type StatusTone } from "@/components/ff/status-mark";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { bookingRef } from "@/lib/api/reservations";
import { localClock, localDate, utcToLocalInput, type ZoneTable, zoneFor } from "@/lib/format/local-time";
import type { LegState } from "@/lib/schedule/day-legs";
import { type LegSummary, legSummaries } from "@/lib/schedule/leg-summary";

import { type FlightSheet, flightSheetAction } from "./actions";

export interface PanelFlight {
  id: string;
  flightNumber: string;
  stops: string[];
  tail: string;
  state: LegState;
}

export const STATE_LABEL: Record<LegState, string> = {
  planned: "Planned",
  released: "Released",
  airborne: "Airborne",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const STATE_TONE: Record<LegState, StatusTone> = {
  planned: "muted",
  released: "blue",
  airborne: "orange",
  completed: "green",
  cancelled: "red",
};

/**
 * A flight on the schedule, opened (#137, #139).
 *
 * The client, 27 Oct: an agent at any base should "look at the schedule,
 * click on the flight, see if there is an open seat available and add
 * their booking to the flight", and anyone looking at the schedule needs
 * the manifest. Their own system opens a flight on one of its legs: the
 * leg's airports and times, and what it carries, as passengers (checked
 * in, bookings, seats), freight and weight (manifested, available,
 * maximum). So this opens on a leg, with a tab for each.
 */
export function FlightPanel({
  flight,
  leg = 0,
  zones,
  open,
  onOpenChange,
}: {
  flight: PanelFlight;
  /** The leg to open on, 0-based. */
  leg?: number;
  zones: ZoneTable;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [selected, setSelected] = useState(leg);
  const [sheet, setSheet] = useState<FlightSheet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    start(async () => {
      const result = await flightSheetAction(flight.id);
      if (result.ok) {
        setSheet(result.data);
        setError(null);
      } else setError(result.message);
    });
  }, [open, flight.id]);

  const stops = sheet?.flight.stops && sheet.flight.stops.length > 1 ? sheet.flight.stops : flight.stops;
  const times = sheet ? legTimes(sheet) : [];
  const summaries = sheet
    ? legSummaries({
        stops,
        seats: sheet.flight.aircraft.seats ?? null,
        bookings: sheet.bookings,
        manifest: sheet.manifest,
        load: sheet.load,
      })
    : [];
  const legCount = Math.max(stops.length - 1, 1);
  const index = Math.min(selected, legCount - 1);
  const current = summaries[index];
  const at = times[index];
  const label = (i: number) => (legCount > 1 ? `${flight.flightNumber}.${i + 1}` : flight.flightNumber);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto p-6 sm:max-w-xl">
        <SheetTitle>Flight {flight.flightNumber}</SheetTitle>
        <SheetDescription>
          <span className="font-mono">{stops.join(" → ")}</span> ·{" "}
          <span className="font-mono">{sheet?.flight.aircraft.tail_number ?? flight.tail}</span>
          {sheet?.flight.aircraft.model ? ` · ${sheet.flight.aircraft.model}` : ""}
        </SheetDescription>

        <div role="tablist" aria-label="Legs" className={`${tabList} mt-4`}>
          {Array.from({ length: legCount }, (_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              onClick={() => setSelected(i)}
              className={`${tab(i === index)} flex-col items-start text-left`}
            >
              <span className="font-mono">
                {stops[i]} → {stops[i + 1]}
              </span>
              <span className="text-[0.7rem] font-normal text-muted-foreground">
                {label(i)}
                {times[i] ? ` · ${localClock(times[i].departs, zoneFor(zones, stops[i]))}` : ""}
              </span>
            </button>
          ))}
        </div>

        {pending && !sheet ? (
          <p role="status" className="mt-6 text-sm text-muted-foreground">
            Loading the flight…
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="notice notice-red mt-6 text-sm">
            {error}
          </p>
        ) : null}
        {sheet ? <LoadFailedNotice what={sheet.failed} className="mt-4" /> : null}

        {sheet && current && at ? (
          <div role="tabpanel" aria-label={`Leg ${index + 1}, ${current.origin} to ${current.destination}`} className="mt-5">
            <div className="flex items-center justify-between">
              <StatusMark label={`${STATE_LABEL[flight.state]} flight`} tone={STATE_TONE[flight.state]} />
              <span className="font-mono text-xs text-muted-foreground">{label(index)}</span>
            </div>
            <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-end gap-3">
              <Airport ident={current.origin} name={sheet.names[current.origin]} time={localClock(at.departs, zoneFor(zones, current.origin))} />
              <span aria-hidden className="pb-6 text-muted-foreground">
                ———→
              </span>
              <Airport
                ident={current.destination}
                name={sheet.names[current.destination]}
                time={localClock(at.arrives, zoneFor(zones, current.origin))}
                end
              />
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Row term="Flight" value={<span className="font-mono">{label(index)}</span>} />
              <Row term="Departs" value={localClock(at.departs, zoneFor(zones, current.origin))} />
              <Row term="Base" value={sheet.base ?? sheet.flight.origin} />
              <Row term="Arrives" value={localClock(at.arrives, zoneFor(zones, current.origin))} />
              <Row term="Date" value={localDate(at.departs, zoneFor(zones, current.origin), { withYear: true })} />
              <Row term="Duration" value={duration(at.departs, at.arrives)} />
            </dl>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Card
                label="Passengers"
                href={`/manifest/${flight.id}#passengers`}
                lines={[
                  `${current.checkedIn} checked in`,
                  `${current.booked} booked`,
                  current.seats ? `${current.seats} seats · ${current.open ?? "?"} open` : "seats not recorded",
                ]}
              />
              <Card
                label="Freight and mail"
                href={`/manifest/${flight.id}#cargo`}
                lines={[`${current.freightItems} item${current.freightItems === 1 ? "" : "s"}`, `${fmt(current.freightLbs)} lb`]}
              />
              <Card label="Weight" href={`/manifest/${flight.id}#load`} lines={weightLines(current)} />
            </div>

            <section aria-label="Bookings" className="mt-6">
              <div className="eyebrow">
                Bookings on this leg · {current.bookings.length}
              </div>
              {current.bookings.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No bookings on this leg yet.</p>
              ) : (
                <ul className="mt-2 divide-y divide-border text-sm">
                  {current.bookings.map((b) => (
                    <li key={b.id} className="py-2">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <Link href={`/reservations/bookings/${b.id}`} className={linkCaps}>
                          {bookingRef(b.id)} <span aria-hidden>›</span>
                        </Link>
                        <span className="text-muted-foreground">
                          {b.customer.full_name} · <span className="font-mono">{b.origin_icao} → {b.destination_icao}</span> ·{" "}
                          {b.pax_count} pax · {b.status}
                        </span>
                      </div>
                      {b.passengers.length > 0 ? (
                        <ul className="mt-1 text-xs">
                          {b.passengers.map((p) => (
                            <li key={p.id}>
                              {p.first_name} {p.last_name}
                              {p.notes ? <span className="text-muted-foreground"> · {p.notes}</span> : null}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Not named yet: adding it on the manifest puts its seats there.
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="mt-6 flex flex-wrap gap-2">
              <Link href={addBookingHref(flight.id, current, at.departs, zoneFor(zones, current.origin))} className={buttonSolid}>
                + Add booking
              </Link>
              <Link href={`/manifest/${flight.id}`} className={buttonOutline}>
                Open manifest
              </Link>
              <Link href={`/dispatch?flight=${flight.id}`} className={buttonOutline}>
                Dispatch packet
              </Link>
              <Link href={`/schedule/${flight.id}/manifest`} target="_blank" rel="noopener noreferrer" className={buttonOutline}>
                Print
              </Link>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

/** The list view's flight number: opens the panel on the first leg. */
export function FlightPanelButton({ flight, zones }: { flight: PanelFlight; zones: ZoneTable }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-mono font-semibold text-foreground underline decoration-dotted underline-offset-4 hover:text-primary"
        aria-label={`Open flight ${flight.flightNumber}`}
      >
        {flight.flightNumber}
      </button>
      {open ? <FlightPanel flight={flight} zones={zones} open={open} onOpenChange={setOpen} /> : null}
    </>
  );
}

function legTimes(sheet: FlightSheet): { departs: string; arrives: string }[] {
  const legs = sheet.flight.legs ?? [];
  if (legs.length > 0) {
    return [...legs]
      .sort((a, b) => a.sequence - b.sequence)
      .map((leg) => ({ departs: leg.scheduled_departure_at, arrives: leg.scheduled_arrival_at }));
  }
  return [{ departs: sheet.flight.scheduled_departure_at, arrives: sheet.flight.scheduled_arrival_at }];
}

function addBookingHref(flightId: string, leg: LegSummary, departs: string, zone: string): string {
  return `/reservations/bookings/new?${new URLSearchParams({
    flight: flightId,
    origin: leg.origin,
    destination: leg.destination,
    date: utcToLocalInput(departs, zone),
    pax: "1",
    return_to: `/manifest/${flightId}`,
  }).toString()}`;
}

function duration(from: string, to: string): string {
  const minutes = Math.round((Date.parse(to) - Date.parse(from)) / 60_000);
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

function weightLines(leg: LegSummary): string[] {
  if (leg.maximumLbs == null) return [`${fmt(leg.manifestedLbs)} lb manifested`, "useful load not set", "Settings → Fleet"];
  return [
    `${fmt(leg.manifestedLbs)} lb manifested`,
    `${fmt(leg.availableLbs ?? 0)} lb available`,
    `${fmt(leg.maximumLbs)} lb maximum${leg.beforeFuel ? ", before fuel" : ""}`,
  ];
}

function Airport({ ident, name, time, end = false }: { ident: string; name?: string; time: string; end?: boolean }) {
  return (
    <div className={end ? "text-right" : ""}>
      <div className="font-mono text-3xl font-semibold text-foreground">{ident}</div>
      <div className="text-xs text-muted-foreground">{name ?? " "}</div>
      <div className="mt-1 text-sm font-semibold text-foreground">{time}</div>
    </div>
  );
}

function Row({ term, value }: { term: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-1">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="text-right font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function Card({ label, href, lines }: { label: string; href: string; lines: string[] }) {
  return (
    <Link
      href={href}
      aria-label={`${label}: ${lines.join(", ")}`}
      className="block border border-border bg-card p-3 transition-colors hover:border-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
    >
      <div className="eyebrow flex items-center justify-between">
        {label} <span aria-hidden>›</span>
      </div>
      <ul className="mt-2 space-y-0.5 text-sm">
        {lines.map((line, i) => (
          <li key={i} className={i === 0 ? "font-semibold text-foreground" : "text-muted-foreground"}>
            {line}
          </li>
        ))}
      </ul>
    </Link>
  );
}
