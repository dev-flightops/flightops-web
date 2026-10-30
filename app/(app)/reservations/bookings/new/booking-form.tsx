"use client";

import { useActionState, useState } from "react";

import type { Customer } from "@/lib/api/reservations";

import { createBookingAction, type NewBookingFormState } from "./actions";
import { CustomerPicker } from "./customer-picker";
import { PassengerRows } from "./passenger-rows";

const _initial: NewBookingFormState = { status: "idle" };

function _defaultDeparture(): string {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  d.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export interface BookingPrefill {
  origin: string | null;
  destination: string | null;
  date: string | null;
  pax: number | null;
  /** A name typed in the search that isn't on file (#137). */
  customerName?: string | null;
}

export function BookingForm({
  customers,
  aircraft,
  preselectCustomerId,
  preselectAircraftId,
  prefill,
  redirectUrlTemplate,
  flightId,
  returnTrip = null,
  returnTo,
  payloadLeft = [],
}: {
  customers: Customer[];
  aircraft: Array<{ id: string; tail_number: string; model: string | null }>;
  preselectCustomerId: string | null;
  preselectAircraftId?: string | null;
  prefill?: BookingPrefill;
  redirectUrlTemplate?: string;
  /** The flight it goes on (#137): picked from a search result, the
   *  schedule or the manifest. */
  flightId?: string | null;
  /** The way back of a return trip (#148): local at its origin, and its
   *  flight when one was picked. Filed with the way out. */
  returnTrip?: { departureLocal: string; flightId: string | null } | null;
  /** Where to land after filing, e.g. back on the manifest. */
  returnTo?: string | null;
  /** What the chosen flights can still carry (#153). */
  payloadLeft?: ReadonlyArray<{ flightNumber: string; lbs: number }>;
}) {
  const [state, formAction, pending] = useActionState(
    createBookingAction,
    _initial,
  );
  const preselected = customers.find((c) => c.id === preselectCustomerId);
  const [customerName, setCustomerName] = useState(
    preselected?.full_name ?? prefill?.customerName ?? "",
  );

  return (
    <form action={formAction} className="space-y-6">
      {flightId ? <input type="hidden" name="flight_id" value={flightId} /> : null}
      {returnTrip ? (
        <>
          <input type="hidden" name="return_departure_at_local" value={returnTrip.departureLocal} />
          {returnTrip.flightId ? (
            <input type="hidden" name="return_flight_id" value={returnTrip.flightId} />
          ) : null}
        </>
      ) : null}
      {returnTo ? <input type="hidden" name="return_to" value={returnTo} /> : null}
      {redirectUrlTemplate ? (
        <input
          type="hidden"
          name="redirect_url"
          value={redirectUrlTemplate}
        />
      ) : null}
      {state.status === "error" && state.message ? (
        <div
          role="alert"
          className="notice notice-red"
        >
          {state.message}
        </div>
      ) : null}

      <CustomerPicker
        customers={customers}
        preselectCustomerId={preselectCustomerId}
        initialName={prefill?.customerName ?? null}
        error={state.fieldErrors?.customer_id}
        onNameChange={setCustomerName}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Origin (ICAO)"
          name="origin_icao"
          error={state.fieldErrors?.origin_icao}
        >
          <input
            id="origin_icao"
            name="origin_icao"
            type="text"
            required
            // Three or four letters and digits — ICAO indicators and
            // the FAA designators the village strips go by. The action
            // checks the same shape; this stops the round trip.
            pattern="[A-Za-z0-9]{3,4}"
            title="An airport code like PANC or A61"
            maxLength={4}
            placeholder="PANC"
            defaultValue={prefill?.origin ?? ""}
            className="ff-input uppercase"
            autoComplete="off"
          />
        </Field>
        <Field
          label="Destination (ICAO)"
          name="destination_icao"
          error={state.fieldErrors?.destination_icao}
        >
          <input
            id="destination_icao"
            name="destination_icao"
            type="text"
            required
            pattern="[A-Za-z0-9]{3,4}"
            title="An airport code like PANC or A61"
            maxLength={4}
            placeholder="PABE"
            defaultValue={prefill?.destination ?? ""}
            className="ff-input uppercase"
            autoComplete="off"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Requested departure"
          name="requested_departure_at_local"
          error={state.fieldErrors?.requested_departure_at_local}
          hint="Local time at the departure base."
        >
          <input
            id="requested_departure_at_local"
            name="requested_departure_at_local"
            type="datetime-local"
            required
            defaultValue={prefill?.date ?? _defaultDeparture()}
            className="ff-input"
          />
        </Field>
      </div>

      <PassengerRows
        initialCount={prefill?.pax ?? 1}
        customerName={customerName}
        error={state.fieldErrors?.passengers}
        payloadLeft={payloadLeft}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Aircraft (preferred)"
          name="aircraft_id"
          hint="Optional; dispatch may reassign."
        >
          <select
            id="aircraft_id"
            name="aircraft_id"
            className="ff-input"
            defaultValue={preselectAircraftId ?? ""}
          >
            <option value="">— None —</option>
            {aircraft.map((a) => (
              <option key={a.id} value={a.id}>
                {a.tail_number}
                {a.model ? ` — ${a.model}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Quote (USD)"
          name="quoted_total_dollars"
          hint="Optional; you can quote later."
          error={state.fieldErrors?.quoted_total_dollars}
        >
          <input
            id="quoted_total_dollars"
            name="quoted_total_dollars"
            type="number"
            min={0}
            step="0.01"
            className="ff-input"
            placeholder="2500.00"
          />
        </Field>
      </div>

      <Field label="Notes" name="notes">
        <textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={4000}
          className="ff-input"
        />
      </Field>

      <div className="flex items-center justify-end gap-2">
        <button
          type="submit"
          disabled={pending}
          className="btn-caps rounded-md bg-primary px-4 py-2 text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {pending ? "Filing…" : "File Booking"}
        </button>
      </div>

    </form>
  );
}

function Field({
  label,
  name,
  hint,
  error,
  children,
}: {
  label: string;
  name: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={name}
        className="field-label"
      >
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p className="mt-1 text-[0.6875rem] text-muted-foreground">{hint}</p>
      ) : null}
      {error ? (
        <p className="field-error">{error}</p>
      ) : null}
    </div>
  );
}
