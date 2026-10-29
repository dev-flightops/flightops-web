import Link from "next/link";

import { linkCaps } from "@/components/ff/controls";
import { loadZoneTable } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { type FlightSearchResult, searchFlights } from "@/lib/api/flight-search";
import { getFleetAirworthiness } from "@/lib/api/maintenance";
import { CUSTOMERS_MAX_LIMIT, listCustomers } from "@/lib/api/reservations";
import { utcToLocalInput, zoneFor } from "@/lib/format/local-time";
import { cn } from "@/lib/utils";

import { BookingForm } from "./booking-form";
import { FlightChoice } from "./flight-choice";

export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: Promise<{
    customer?: string;
    origin?: string;
    destination?: string;
    date?: string;
    pax?: string;
    aircraft?: string;
    /** The flight it goes on (#137): a search result, the schedule or the
     *  manifest. "Book" from a search result had passed it and the form
     *  dropped it, so the booking was filed with no flight. */
    flight?: string;
    /** A name typed in the search that isn't on file. */
    customer_name?: string;
    /** Where to land after filing. */
    return_to?: string;
    /** A return trip (#148): the way back's day and, once picked, its flight. */
    return_date?: string;
    return_flight?: string;
  }>;
}) {
  const params = await searchParams;
  // Server-side prefetch: customers (searchable but a short seed list
  // is enough here) + active aircraft for the picker.
  let customers: Awaited<ReturnType<typeof listCustomers>>["items"] = [];
  let aircraft: Array<{ id: string; tail_number: string; model: string | null }> =
    [];
  try {
    customers = (await listCustomers({ limit: CUSTOMERS_MAX_LIMIT })).items;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) throw err;
  }
  try {
    const fleet = await getFleetAirworthiness();
    aircraft = fleet.items
      .filter((f) => f.is_active)
      .map((f) => f.aircraft);
  } catch {
    aircraft = [];
  }

  // The flights on that route that day (#137): the client wanted the
  // booking desk told "this is the flight option or there is no flight
  // option". Listed with the full ones, so a full flight reads as full.
  const day = (params.date ?? "").slice(0, 10);
  const pax = params.pax ? Number(params.pax) || 1 : 1;
  let flights: FlightSearchResult[] | null = null;
  if (params.origin && params.destination && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
    try {
      flights = (
        await searchFlights({
          origin: params.origin,
          destination: params.destination,
          date: day,
          paxCount: pax,
          showUnavailable: true,
        })
      ).items;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) throw err;
      flights = null;
    }
  }
  const chosen = flights?.find((f) => f.flight_id === params.flight) ?? null;
  // On a chosen flight the party wants its departure: the leg they board,
  // local at that stop, not the search's 09:00.
  const departs = chosen
    ? utcToLocalInput(chosen.scheduled_departure_at, zoneFor(await loadZoneTable(), chosen.origin))
    : (params.date ?? null);
  // The way back of a return trip (#148): destination to origin on its day.
  const backDay = (params.return_date ?? "").slice(0, 10);
  const isReturn = /^\d{4}-\d{2}-\d{2}$/.test(backDay) && Boolean(params.origin && params.destination);
  let flightsBack: FlightSearchResult[] | null = null;
  if (isReturn) {
    try {
      flightsBack = (
        await searchFlights({
          origin: params.destination ?? "",
          destination: params.origin ?? "",
          date: backDay,
          paxCount: pax,
          showUnavailable: true,
        })
      ).items;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) throw err;
      flightsBack = null;
    }
  }
  const chosenBack = flightsBack?.find((f) => f.flight_id === params.return_flight) ?? null;
  const backDeparts = chosenBack
    ? utcToLocalInput(chosenBack.scheduled_departure_at, zoneFor(await loadZoneTable(), chosenBack.origin))
    : `${backDay}T09:00`;

  const returnTo = params.return_to?.startsWith("/") && !params.return_to.startsWith("//")
    ? params.return_to
    : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <header className="mb-6 border-b border-border pb-5">
        <Link href="/reservations" className={cn(linkCaps, "text-muted-foreground hover:text-foreground")}>
          <span aria-hidden>‹</span> Reservations
        </Link>
        <h1 className="mt-2 page-title">
          New Booking
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Assign a customer, route, and departure time. Aircraft and
          quote can be filled in later.
        </p>
      </header>

      <FlightChoice
        flights={flights}
        chosen={chosen}
        chosenId={params.flight ?? null}
        searched={{
          origin: params.origin ?? "",
          destination: params.destination ?? "",
          day,
        }}
        query={params}
        heading={isReturn ? "Way out" : undefined}
      />

      {isReturn ? (
        <p className="mb-3 text-sm">
          {`Return trip: filing books the way back too, ${params.destination} → ${params.origin}, for the same passengers.`}
        </p>
      ) : null}
      {isReturn ? (
        <FlightChoice
          flights={flightsBack}
          chosen={chosenBack}
          chosenId={params.return_flight ?? null}
          searched={{
            origin: params.destination ?? "",
            destination: params.origin ?? "",
            day: backDay,
          }}
          query={params}
          param="return_flight"
          heading="Way back"
        />
      ) : null}

      <BookingForm
          customers={customers}
          aircraft={aircraft}
          preselectCustomerId={params.customer ?? null}
          preselectAircraftId={params.aircraft ?? null}
          prefill={{
            origin: params.origin ?? null,
            destination: params.destination ?? null,
            date: departs,
            pax: params.pax ? Number(params.pax) || null : null,
            customerName: params.customer_name ?? null,
          }}
          flightId={chosen ? chosen.flight_id : null}
          returnTrip={isReturn ? { departureLocal: backDeparts, flightId: chosenBack?.flight_id ?? null } : null}
          returnTo={returnTo}
        />
    </div>
  );
}
