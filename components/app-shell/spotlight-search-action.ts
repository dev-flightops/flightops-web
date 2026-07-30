"use server";

import { ApiError } from "@/lib/api/client";
import { listAircraft, listFlights } from "@/lib/api/ops";
import { listBookings, listCustomers } from "@/lib/api/reservations";

/** One row in the spotlight results dropdown. */
export interface SpotlightHit {
  id: string;
  label: string;
  sublabel?: string;
  href: string;
}

/** A group of same-kind results (Customers, Bookings, Aircraft, …). */
export interface SpotlightGroup {
  key: "customers" | "aircraft" | "bookings" | "flights";
  label: string;
  items: SpotlightHit[];
}

const MAX_PER_GROUP = 5;

/** Global spotlight search. Fans out to the four searchable list
 *  endpoints in parallel and returns grouped hits. Customers use the
 *  backend's `q` filter directly; aircraft / bookings / flights don't
 *  have `q` today, so we page-1 those and filter client-side (the
 *  demo tenant is small enough that this is fine for now). */
export async function spotlightSearch(
  query: string,
): Promise<SpotlightGroup[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const lower = q.toLowerCase();

  const results = await Promise.allSettled([
    _customers(q, lower),
    _aircraft(lower),
    _bookings(lower),
    _flights(lower),
  ]);

  const groups: SpotlightGroup[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.items.length > 0) {
      groups.push(r.value);
    }
    // 401 from any single endpoint (e.g. non-exec_admin hitting users)
    // just drops that group; other groups still render.
  }
  return groups;
}

async function _customers(
  q: string,
  lower: string,
): Promise<SpotlightGroup> {
  try {
    const { items } = await listCustomers({ q, limit: 20 });
    const hits: SpotlightHit[] = items.slice(0, MAX_PER_GROUP).map((c) => ({
      id: c.id,
      label: c.full_name,
      sublabel: c.company_name ?? c.email ?? undefined,
      href: `/customers/${c.id}`,
    }));
    return { key: "customers", label: "Customers", items: hits };
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) throw err;
    return { key: "customers", label: "Customers", items: [] };
  }
  // Suppress unused-var if the compiler doesn't see the closure use of lower.
  void lower;
}

async function _aircraft(lower: string): Promise<SpotlightGroup> {
  try {
    const { items } = await listAircraft();
    const matched = items.filter(
      (a) =>
        a.tail_number.toLowerCase().includes(lower) ||
        (a.model?.toLowerCase().includes(lower) ?? false),
    );
    const hits: SpotlightHit[] = matched.slice(0, MAX_PER_GROUP).map((a) => ({
      id: a.id,
      label: a.tail_number,
      sublabel: a.model ?? `${a.seats} seats`,
      href: `/settings/fleet`,
    }));
    return { key: "aircraft", label: "Aircraft", items: hits };
  } catch {
    return { key: "aircraft", label: "Aircraft", items: [] };
  }
}

async function _bookings(lower: string): Promise<SpotlightGroup> {
  try {
    const { items } = await listBookings({ limit: 100 });
    const matched = items.filter((b) => {
      const shortId = b.id.slice(0, 8).toLowerCase();
      return (
        b.origin_icao.toLowerCase().includes(lower) ||
        b.destination_icao.toLowerCase().includes(lower) ||
        b.customer.full_name.toLowerCase().includes(lower) ||
        (b.customer.company_name?.toLowerCase().includes(lower) ?? false) ||
        shortId.includes(lower)
      );
    });
    const hits: SpotlightHit[] = matched.slice(0, MAX_PER_GROUP).map((b) => ({
      id: b.id,
      label: `${b.origin_icao} → ${b.destination_icao}`,
      sublabel: `${b.customer.full_name} · ${new Date(b.requested_departure_at).toLocaleDateString()}`,
      href: `/reservations/bookings/${b.id}`,
    }));
    return { key: "bookings", label: "Bookings", items: hits };
  } catch {
    return { key: "bookings", label: "Bookings", items: [] };
  }
}

async function _flights(lower: string): Promise<SpotlightGroup> {
  try {
    const { items } = await listFlights({ limit: 100 });
    const matched = items.filter(
      (f) =>
        f.flight_number.toLowerCase().includes(lower) ||
        f.origin.toLowerCase().includes(lower) ||
        f.destination.toLowerCase().includes(lower) ||
        f.aircraft.tail_number.toLowerCase().includes(lower),
    );
    const hits: SpotlightHit[] = matched.slice(0, MAX_PER_GROUP).map((f) => ({
      id: f.id,
      label: `${f.flight_number} · ${f.origin} → ${f.destination}`,
      sublabel: `${f.aircraft.tail_number} · ${new Date(f.scheduled_departure_at).toLocaleDateString()}`,
      href: `/flight-following/${f.id}`,
    }));
    return { key: "flights", label: "Flights", items: hits };
  } catch {
    return { key: "flights", label: "Flights", items: [] };
  }
}
