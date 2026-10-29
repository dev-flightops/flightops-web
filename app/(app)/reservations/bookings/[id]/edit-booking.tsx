"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";

import { buttonOutline, buttonSolid, linkCaps } from "@/components/ff/controls";
import type { AircraftRef, Booking, BookingPassenger } from "@/lib/api/reservations";
import { cn } from "@/lib/utils";

import { type EditBookingState, updateBookingAction } from "./actions";

const _initial: EditBookingState = { status: "idle" };

/**
 * Edit a booking (#147). The client, 29 Oct: "Need a way to edit bookings
 * after they are entered." As legacy's booking edit, at any stage but
 * cancelled; each change is kept in the booking's history below. Once its
 * passengers are on its flight's manifest, who they are, how many and the
 * route change there, so the form shows them and leaves them alone.
 */
export function EditBooking({
  booking,
  aircraft,
  departureLocal,
  zoneLabel,
}: {
  booking: Booking;
  aircraft: AircraftRef[];
  /** The departure in the origin's local time, as the form edits it. */
  departureLocal: string;
  /** "AKDT at PABE". */
  zoneLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateBookingAction, _initial);
  const named = booking.passengers ?? [];
  const onManifest = booking.flight !== null && named.length > 0;
  // Keyed apart from their place, so removing one leaves the others' boxes as typed.
  const nextKey = useRef(named.length);
  const [people, setPeople] = useState<{ key: number; p: BookingPassenger }[]>(() =>
    named.map((p, key) => ({ key, p })),
  );
  const errors = state.fieldErrors ?? {};

  if (!open) {
    return (
      <div className="mb-6">
        <button type="button" className={buttonOutline} onClick={() => setOpen(true)}>
          Edit booking
        </button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      aria-label="Edit booking"
      className="mb-6 space-y-4 rounded-lg border border-border bg-card p-5"
    >
      <h2 className="panel-title">Edit booking</h2>
      {booking.status === "completed" ? (
        <p className="text-xs text-muted-foreground">
          This booking is completed. Changes are kept in its history.
        </p>
      ) : null}
      <input type="hidden" name="booking_id" value={booking.id} />
      <input type="hidden" name="origin_current" value={booking.origin_icao} />
      <input type="hidden" name="route_editable" value={onManifest ? "0" : "1"} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="From" error={errors.origin_icao}>
          <input
            name="origin_icao"
            defaultValue={booking.origin_icao}
            maxLength={4}
            disabled={onManifest}
            className="ff-input uppercase"
          />
        </Field>
        <Field label="To" error={errors.destination_icao}>
          <input
            name="destination_icao"
            defaultValue={booking.destination_icao}
            maxLength={4}
            disabled={onManifest}
            className="ff-input uppercase"
          />
        </Field>
        <Field label={`Departure (${zoneLabel})`} error={errors.requested_departure_at_local}>
          <input
            type="datetime-local"
            name="requested_departure_at_local"
            defaultValue={departureLocal}
            className="ff-input"
          />
        </Field>
        <Field label="Aircraft">
          <select name="aircraft_id" defaultValue={booking.aircraft?.id ?? ""} className="ff-input">
            <option value="">{booking.aircraft ? "Keep as is" : "— (dispatch to assign)"}</option>
            {aircraft.map((a) => (
              <option key={a.id} value={a.id}>
                {a.tail_number}
                {a.model ? ` (${a.model})` : ""}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {onManifest ? (
        <p className="text-sm">
          {`${named.length} ${named.length === 1 ? "passenger is" : "passengers are"} on ${booking.flight?.flight_number}'s manifest: change who, how many and the route there. `}
          <Link href={`/manifest/${booking.flight?.id}`} className={linkCaps}>
            Open the manifest ›
          </Link>
        </p>
      ) : named.length > 0 ? (
        <fieldset className="min-w-0">
          <legend className="field-label">Passengers</legend>
          <input type="hidden" name="edit_passengers" value="1" />
          <ul className="space-y-2">
            {people.map(({ key, p }, i) => (
              <li key={key} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_6rem_1fr_auto]">
                <input
                  name="passenger_first_name"
                  aria-label={`Passenger ${i + 1} first name`}
                  defaultValue={p.first_name}
                  className="ff-input"
                />
                <input
                  name="passenger_last_name"
                  aria-label={`Passenger ${i + 1} last name`}
                  defaultValue={p.last_name}
                  className="ff-input"
                />
                <input
                  name="passenger_weight_lbs"
                  aria-label={`Passenger ${i + 1} weight (lb)`}
                  inputMode="numeric"
                  defaultValue={p.weight_lbs ?? ""}
                  placeholder="lb"
                  className="ff-input"
                />
                <input
                  name="passenger_notes"
                  aria-label={`Passenger ${i + 1} notes`}
                  defaultValue={p.notes ?? ""}
                  placeholder="Notes"
                  className="ff-input"
                />
                <input type="hidden" name="passenger_baggage_lbs" value={p.baggage_lbs ?? ""} />
                <input type="hidden" name="passenger_contact_phone" value={p.contact_phone ?? ""} />
                <input type="hidden" name="passenger_contact_email" value={p.contact_email ?? ""} />
                <button
                  type="button"
                  className={cn(linkCaps, "self-center")}
                  onClick={() => setPeople((rows) => rows.filter((row) => row.key !== key))}
                  disabled={people.length === 1}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className={cn(linkCaps, "mt-2")}
            onClick={() =>
              setPeople((rows) => [...rows, { key: nextKey.current++, p: { first_name: "", last_name: "" } }])
            }
          >
            + Add passenger
          </button>
          {errors.passengers ? <p role="alert" className="field-error">{errors.passengers}</p> : null}
        </fieldset>
      ) : (
        <Field label="Pax" error={errors.pax_count}>
          <input
            type="number"
            name="pax_count"
            min={0}
            max={999}
            defaultValue={booking.pax_count}
            className="ff-input w-24"
          />
        </Field>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Cargo">
          <input name="cargo_notes" defaultValue={booking.cargo_notes ?? ""} className="ff-input" />
        </Field>
        <Field label="Quote (USD)" error={errors.quoted_total_dollars}>
          <input
            name="quoted_total_dollars"
            inputMode="decimal"
            defaultValue={
              booking.quoted_total_cents !== null ? (booking.quoted_total_cents / 100).toFixed(2) : ""
            }
            className="ff-input"
          />
        </Field>
      </div>
      <Field label="Notes">
        <textarea name="notes" rows={3} defaultValue={booking.notes ?? ""} className="ff-input" />
      </Field>

      {state.status === "error" && state.message ? (
        <p role="alert" className="notice notice-red text-sm">
          {state.message}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <button type="button" className={buttonOutline} onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button type="submit" className={buttonSolid} disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="field-label">{label}</span>
      {children}
      {error ? <span role="alert" className="field-error block">{error}</span> : null}
    </label>
  );
}
