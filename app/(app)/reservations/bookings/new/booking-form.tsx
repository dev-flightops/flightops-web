"use client";

import { useActionState } from "react";

import type { Customer } from "@/lib/api/reservations";

import { createBookingAction, type NewBookingFormState } from "./actions";

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
}

export function BookingForm({
  customers,
  aircraft,
  preselectCustomerId,
  prefill,
}: {
  customers: Customer[];
  aircraft: Array<{ id: string; tail_number: string; model: string | null }>;
  preselectCustomerId: string | null;
  prefill?: BookingPrefill;
}) {
  const [state, formAction, pending] = useActionState(
    createBookingAction,
    _initial,
  );

  return (
    <form action={formAction} className="space-y-6">
      {state.status === "error" && state.message ? (
        <div
          role="alert"
          className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
        >
          {state.message}
        </div>
      ) : null}

      <Field
        label="Customer"
        name="customer_id"
        error={state.fieldErrors?.customer_id}
      >
        <select
          id="customer_id"
          name="customer_id"
          required
          className="ff-input"
          defaultValue={preselectCustomerId ?? ""}
        >
          <option value="" disabled>
            Select…
          </option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name}
              {c.company_name ? ` — ${c.company_name}` : ""}
            </option>
          ))}
        </select>
      </Field>

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
            maxLength={10}
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
            maxLength={10}
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
          hint="Local time."
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
        <Field
          label="Pax"
          name="pax_count"
          error={state.fieldErrors?.pax_count}
        >
          <input
            id="pax_count"
            name="pax_count"
            type="number"
            min={0}
            max={999}
            required
            defaultValue={prefill?.pax ?? 1}
            className="ff-input"
          />
        </Field>
      </div>

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
            defaultValue=""
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
          className="rounded-md bg-status-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
        >
          {pending ? "Filing…" : "File Booking"}
        </button>
      </div>

      <style>{`
        .ff-input {
          width: 100%;
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          border: 1px solid hsl(var(--border));
          border-radius: 8px;
          padding: 0.5rem 0.75rem;
          font-size: 0.8125rem;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .ff-input:focus:not(:disabled) {
          border-color: hsl(var(--primary));
          box-shadow: 0 0 0 3px hsl(var(--primary) / 0.12);
        }
        textarea.ff-input { resize: vertical; font-family: inherit; }
      `}</style>
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
        className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
      >
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p className="mt-1 text-[0.6875rem] text-muted-foreground/80">{hint}</p>
      ) : null}
      {error ? (
        <p className="mt-1 text-[0.6875rem] text-status-red">{error}</p>
      ) : null}
    </div>
  );
}
