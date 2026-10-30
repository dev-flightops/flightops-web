import Link from "next/link";

import { linkCaps } from "@/components/ff/controls";
import { loadZoneTable } from "@/lib/api/auth";
import { type FlightSearchResult, UNAVAILABLE_REASON_LABELS } from "@/lib/api/flight-search";
import { localClock, localDate, zoneFor } from "@/lib/format/local-time";
import { payloadLeftText } from "@/lib/reservations/payload-text";
import { cn } from "@/lib/utils";

/**
 * Which flight the booking goes on (#137).
 *
 * The client, 27 Oct: "Ideally if a flight booking is made to a village on
 * a day and that is the only thing that is scheduled to go there it will
 * prompt the CSA or reservations person that this is the flight option or
 * there is no flight option." So the form names the flight it's for, or
 * lists the flights on that route that day, or says there's none and the
 * booking waits for one (listed on the manifest when a flight is built).
 */
export async function FlightChoice({
  flights,
  chosen,
  chosenId,
  searched,
  query,
  param = "flight",
  heading,
}: {
  flights: FlightSearchResult[] | null;
  chosen: FlightSearchResult | null;
  chosenId: string | null;
  searched: { origin: string; destination: string; day: string };
  query: Record<string, string | undefined>;
  /** The query parameter the pick goes in: "return_flight" for a return
   *  trip's way back (#148). */
  param?: string;
  /** "Way out" or "Way back" on a return trip (#148). */
  heading?: string;
}) {
  if (flights === null) return null;
  const zones = await loadZoneTable();
  const zone = zoneFor(zones, searched.origin);
  const route = `${searched.origin} → ${searched.destination}`;
  const dayText = searched.day ? localDate(`${searched.day}T12:00:00Z`, "UTC", { withYear: true }) : "";

  const why = (f: FlightSearchResult) =>
    f.unavailable_reason ? UNAVAILABLE_REASON_LABELS[f.unavailable_reason] : "Unavailable";

  function hrefFor(flightId: string | null): string {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && key !== param) next.set(key, value);
    }
    if (flightId) next.set(param, flightId);
    return `/reservations/bookings/new?${next.toString()}`;
  }

  if (chosen) {
    return (
      <section aria-label={heading ?? "Flight"} className="mb-6 border-l-[3px] border-primary bg-card px-4 py-3">
        <div className="eyebrow">{heading ? `${heading} · on flight` : "On flight"}</div>
        <p className="mt-1 text-sm">
          <span className="font-mono font-semibold">{chosen.flight_number}</span>
          {" · "}
          {(chosen.route && chosen.route.length > 1 ? chosen.route : [chosen.origin, chosen.destination]).join(" → ")}
          {" · departs "}
          {searched.origin} {localDate(chosen.scheduled_departure_at, zone)},{" "}
          {localClock(chosen.scheduled_departure_at, zone)}
        </p>
        <p className="mt-1 text-sm">
          {chosen.is_available
            ? `${chosen.seats_available} of ${chosen.seats_total} seats open on ${route}. Filing it puts the passengers on this flight's manifest.`
            : `${why(chosen)}: ${chosen.seats_available} of ${chosen.seats_total} seats open on ${route}.`}
        </p>
        {chosen.payload_left_lbs != null ? (
          // What it can still carry (#153).
          <p className={`mt-1 text-sm ${chosen.payload_left_lbs < 0 ? "text-status-red" : ""}`}>
            {`Payload: ${payloadLeftText(chosen.payload_left_lbs)}, after crew and fuel.`}
          </p>
        ) : null}
        <Link href={hrefFor(null)} className={cn(linkCaps, "mt-2 inline-block")}>
          Choose another flight <span aria-hidden>›</span>
        </Link>
      </section>
    );
  }

  const open = flights.filter((f) => f.is_available);
  return (
    <section aria-label={heading ?? "Flights that day"} className="mb-6 bg-card px-4 py-3">
      {heading ? <div className="eyebrow mb-1">{heading}</div> : null}
      {chosenId ? (
        <p role="alert" className="notice notice-yellow mb-3 text-sm">
          That flight doesn&apos;t go {route} on {dayText}. Pick one below, or file the booking to wait for one.
        </p>
      ) : null}
      {flights.length === 0 ? (
        <p className="text-sm">
          <span className="font-semibold">No flight goes {route} on {dayText} yet.</span> File the booking
          and it waits for one: when a flight is built, the booking is listed on its manifest to add.
        </p>
      ) : (
        <>
          <div className="eyebrow">
            {open.length === 1 ? `The flight ${route} on ${dayText}` : `Flights ${route} on ${dayText}`}
          </div>
          <ul className="mt-2 divide-y divide-border">
            {flights.map((f) => (
              <li key={f.flight_id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <span className="font-mono font-semibold">{f.flight_number}</span>
                  {" · "}
                  {localClock(f.scheduled_departure_at, zone)}
                  {" · "}
                  {(f.route && f.route.length > 1 ? f.route : [f.origin, f.destination]).join(" → ")}
                  {" · "}
                  {f.is_available
                    ? `${f.seats_available} seat${f.seats_available === 1 ? "" : "s"} open`
                    : why(f)}
                </span>
                {f.is_available ? (
                  <Link href={hrefFor(f.flight_id)} className={linkCaps}>
                    Book on this flight <span aria-hidden>›</span>
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
          {open.length === 1 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              It&apos;s the only flight with seats going there that day.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
