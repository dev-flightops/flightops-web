"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import { createBooking } from "@/lib/api/reservations";

const _schema = z.object({
  customer_id: z.string().uuid("Pick a customer."),
  origin_icao: z
    .string()
    .trim()
    .min(2, "Origin ICAO required.")
    .max(10)
    .transform((s) => s.toUpperCase()),
  destination_icao: z
    .string()
    .trim()
    .min(2, "Destination ICAO required.")
    .max(10)
    .transform((s) => s.toUpperCase()),
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

  redirect(`/reservations/bookings/${newId}?filed=1`);
}
