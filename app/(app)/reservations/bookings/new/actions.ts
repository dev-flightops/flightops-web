"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import { createBooking } from "@/lib/api/reservations";

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
  customer_id: z.string().uuid("Pick a customer."),
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
});

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
    origin_icao: formData.get("origin_icao") ?? "",
    destination_icao: formData.get("destination_icao") ?? "",
    requested_departure_at_local:
      formData.get("requested_departure_at_local") ?? "",
    aircraft_id: formData.get("aircraft_id") ?? "",
    pax_count: formData.get("pax_count") ?? "1",
    quoted_total_dollars: formData.get("quoted_total_dollars") ?? "",
    notes: formData.get("notes") ?? "",
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
  let departureIso: string;
  try {
    departureIso = new Date(v.requested_departure_at_local).toISOString();
  } catch {
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
    const created = await createBooking({
      customer_id: v.customer_id,
      origin_icao: v.origin_icao,
      destination_icao: v.destination_icao,
      requested_departure_at: departureIso,
      aircraft_id: v.aircraft_id || null,
      pax_count: v.pax_count,
      quoted_total_cents: quotedCents,
      notes: v.notes || null,
    });
    newId = created.id;
  } catch (err) {
    if (err instanceof ApiError) {
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

  redirect(`/reservations/bookings/${newId}?filed=1`);
}
