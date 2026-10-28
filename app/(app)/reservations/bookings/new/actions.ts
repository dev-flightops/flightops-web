"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { loadZoneTable } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { type BookingPassenger, createBooking, createCustomer } from "@/lib/api/reservations";
import { localToUtcIso, zoneFor } from "@/lib/format/local-time";
import { refusalMessage } from "@/lib/reservations/refusals";

/**
 * An airport identifier on a new booking.
 *
 * This was `min(2).max(10)` with no shape, which accepted "PANC`" —
 * and one reached the live data. Origin and destination are what a
 * booking is matched to a flight on, so a booking filed against an
 * airport that cannot exist can never be put on one: it sits in the
 * dispatch queue reading "no flights scheduled on this route that day"
 * for ever, and the fault reads as dispatch being broken.
 *
 * Three characters is the floor rather than four because plenty of the
 * strips this operation serves have no ICAO indicator and go by their
 * FAA designator (A61, 5KE).
 *
 * Trim and upper-case first, then check — so " panc " is a booking for
 * PANC rather than an error message.
 */
function airportId(label: string) {
  return z
    .string()
    .trim()
    .transform((s) => s.toUpperCase())
    .refine((s) => s.length > 0, `${label} required.`)
    .refine(
      (s) => s.length === 0 || /^[A-Z0-9]{3,4}$/.test(s),
      `${label} should be an airport code like PANC or A61.`,
    );
}

const _schema = z.object({
  // An existing customer, or a new one by name (#137): one of the two.
  customer_id: z.string().uuid().optional().or(z.literal("")),
  new_customer_name: z.string().trim().max(200).optional(),
  origin_icao: airportId("Origin"),
  destination_icao: airportId("Destination"),
  requested_departure_at_local: z
    .string()
    .min(1, "Departure time required."),
  aircraft_id: z.string().uuid().optional().or(z.literal("")),
  pax_count: z
    .string()
    .transform((s) => Number(s))
    .refine((n) => Number.isFinite(n) && n >= 0 && n <= 999, "Pax count 0-999."),
  quoted_total_dollars: z.string().optional(),
  notes: z.string().trim().max(4000).optional(),
  flight_id: z.string().uuid().optional().or(z.literal("")),
});

/** Where to land after filing (#137): a path in this app, never another
 *  site; anything else is ignored rather than refused, since it's no
 *  field the agent can fix. */
function _returnTo(formData: FormData): string | null {
  const to = String(formData.get("return_to") ?? "");
  return /^\/(?!\/)[A-Za-z0-9/_?=&%.-]*$/.test(to) ? to : null;
}

/** The passenger rows (#137), in the order on the form; a row with no
 *  first name is a row left empty. */
function _passengers(formData: FormData): BookingPassenger[] | string {
  const firsts = formData.getAll("passenger_first_name").map(String);
  const lasts = formData.getAll("passenger_last_name").map(String);
  const weights = formData.getAll("passenger_weight_lbs").map(String);
  const notes = formData.getAll("passenger_notes").map(String);
  const people: BookingPassenger[] = [];
  for (let i = 0; i < firsts.length; i++) {
    const first = firsts[i].trim();
    if (!first) continue;
    const weightText = (weights[i] ?? "").trim();
    const weight = weightText === "" ? null : Number(weightText);
    if (weight !== null && (!Number.isFinite(weight) || weight < 0 || weight > 1000)) {
      return `Passenger ${i + 1}'s weight should be 0-1000 lb.`;
    }
    people.push({
      first_name: first.slice(0, 80),
      last_name: (lasts[i] ?? "").trim().slice(0, 80),
      weight_lbs: weight,
      notes: (notes[i] ?? "").trim().slice(0, 500) || null,
    });
  }
  return people;
}

export interface NewBookingFormState {
  status: "idle" | "error" | "ok";
  message?: string;
  fieldErrors?: Record<string, string>;
}

export async function createBookingAction(
  _prev: NewBookingFormState,
  formData: FormData,
): Promise<NewBookingFormState> {
  const parsed = _schema.safeParse({
    customer_id: formData.get("customer_id") ?? "",
    new_customer_name: formData.get("new_customer_name") ?? "",
    origin_icao: formData.get("origin_icao") ?? "",
    destination_icao: formData.get("destination_icao") ?? "",
    requested_departure_at_local:
      formData.get("requested_departure_at_local") ?? "",
    aircraft_id: formData.get("aircraft_id") ?? "",
    pax_count: formData.get("pax_count") ?? "1",
    quoted_total_dollars: formData.get("quoted_total_dollars") ?? "",
    notes: formData.get("notes") ?? "",
    flight_id: formData.get("flight_id") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const v = parsed.data;
  if (!v.customer_id && (v.new_customer_name ?? "").length < 2) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: { customer_id: "Pick a customer, or type a new customer's name." },
    };
  }
  const passengers = _passengers(formData);
  if (typeof passengers === "string") {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: { passengers },
    };
  }
  // Local at the departure base (#68). `new Date(local)` read it in the
  // server's own zone, which on Vercel is UTC: a 10:00 booking was
  // stored as 10:00Z, 02:00 in Alaska.
  const departureIso = localToUtcIso(
    v.requested_departure_at_local,
    zoneFor(await loadZoneTable(), v.origin_icao),
  );
  if (!departureIso) {
    return {
      status: "error",
      message: "Invalid departure time.",
      fieldErrors: {
        requested_departure_at_local: "Pick a valid date and time.",
      },
    };
  }

  // Dollars → cents. Empty string means "no quote yet".
  let quotedCents: number | null = null;
  if (v.quoted_total_dollars && v.quoted_total_dollars.trim() !== "") {
    const dollars = Number(v.quoted_total_dollars);
    if (!Number.isFinite(dollars) || dollars < 0) {
      return {
        status: "error",
        message: "Invalid quote amount.",
        fieldErrors: { quoted_total_dollars: "Amount must be ≥ 0." },
      };
    }
    quotedCents = Math.round(dollars * 100);
  }

  let newId: string;
  try {
    // A caller not on file becomes a customer as the booking is filed
    // (#137): the manual form had offered only the customers already there.
    const customerId =
      v.customer_id || (await createCustomer({ full_name: v.new_customer_name ?? "" })).id;
    const created = await createBooking({
      customer_id: customerId,
      origin_icao: v.origin_icao,
      destination_icao: v.destination_icao,
      requested_departure_at: departureIso,
      aircraft_id: v.aircraft_id || null,
      pax_count: passengers.length || v.pax_count,
      passengers,
      flight_id: v.flight_id || null,
      quoted_total_cents: quotedCents,
      notes: v.notes || null,
    });
    newId = created.id;
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 409 || err.status === 404) {
        return { status: "error", message: refusalMessage(err.message) };
      }
      return {
        status: "error",
        message: `Backend rejected the booking (HTTP ${err.status}).`,
      };
    }
    return {
      status: "error",
      message: "Could not reach reservations-service.",
    };
  }

  // Optional redirect override — used by the Fleet Board's
  // "book from empty cell" flow so success lands back on the
  // board with the new booking's drawer open, instead of the
  // standalone detail page. Callers pass a URL template where
  // %NEWID% is replaced by the created booking's id.
  const redirectTemplate = formData.get("redirect_url");
  if (typeof redirectTemplate === "string" && redirectTemplate.trim() !== "") {
    redirect(redirectTemplate.replace("%NEWID%", newId));
  }

  // Back where it was started (#137): the manifest or the schedule.
  const returnTo = _returnTo(formData);
  if (returnTo) {
    redirect(returnTo);
  }

  redirect(`/reservations/bookings/${newId}?filed=1`);
}
