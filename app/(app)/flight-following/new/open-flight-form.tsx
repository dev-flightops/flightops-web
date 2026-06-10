"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Spinner } from "@/components/ui/spinner";
import type { AircraftListItem } from "@/lib/api/types";

import {
  createFlightAction,
  type CreateFlightFormState,
} from "./actions";

/**
 * "+ Open Flight" form (M2-G-14). Client component because we want
 * useActionState for inline field errors and a pending state on the
 * submit button without a router round-trip.
 *
 * The form mirrors the legacy `templates/flight_following/flight_form.html`
 * new-flight branch with two intentional differences:
 *   - Aircraft is a select bound to the tenant's active aircraft list
 *     (legacy was a free-text "n_number" input — easy to typo).
 *   - PIC name + Route are omitted; we don't have those columns on
 *     the Flight model yet (M3 crew + route storage).
 */
export function OpenFlightForm({
  aircraft,
}: {
  aircraft: AircraftListItem[];
}) {
  const [state, action, pending] = useActionState<
    CreateFlightFormState,
    FormData
  >(createFlightAction, { status: "idle" });

  const fieldError = (field: string): string | undefined =>
    state.status === "field-errors" ? state.errors[field] : undefined;

  return (
    <form action={action} className="space-y-5">
      {state.status === "api-error" && (
        <div
          role="alert"
          className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
        >
          {state.message}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          name="flight_number"
          label="Flight number"
          required
          placeholder="GV101"
          error={fieldError("flight_number")}
        />
        <FieldSelect
          name="aircraft_id"
          label="Aircraft"
          required
          error={fieldError("aircraft_id")}
        >
          <option value="">Select aircraft…</option>
          {aircraft.map((a) => (
            <option key={a.id} value={a.id}>
              {a.tail_number} — {a.model}
            </option>
          ))}
        </FieldSelect>
        <Field
          name="origin"
          label="Origin ICAO"
          required
          placeholder="PANC"
          maxLength={4}
          autoCapitalize="characters"
          spellCheck={false}
          error={fieldError("origin")}
        />
        <Field
          name="destination"
          label="Destination ICAO"
          required
          placeholder="PAEN"
          maxLength={4}
          autoCapitalize="characters"
          spellCheck={false}
          error={fieldError("destination")}
        />
        <Field
          name="scheduled_departure_at"
          label="ETD (UTC)"
          type="datetime-local"
          required
          error={fieldError("scheduled_departure_at")}
        />
        <Field
          name="scheduled_arrival_at"
          label="ETA (UTC)"
          type="datetime-local"
          required
          error={fieldError("scheduled_arrival_at")}
        />
        <Field
          name="pax_count"
          label="Passengers"
          type="number"
          min={0}
          defaultValue={0}
          error={fieldError("pax_count")}
        />
        <Field
          name="cargo_lbs"
          label="Cargo (lbs)"
          type="number"
          min={0}
          defaultValue={0}
          error={fieldError("cargo_lbs")}
        />
      </div>

      <div>
        <label
          htmlFor="notes"
          className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
        >
          Ops notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={500}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-status-blue focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-status-blue px-4 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50"
        >
          {pending && <Spinner size="xs" />}
          {pending ? "Opening…" : "Open Flight"}
        </button>
        <Link
          href="/flight-following"
          className="text-xs font-medium text-muted-foreground hover:underline"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  error,
  required,
  ...inputProps
}: React.InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  label: string;
  error?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
      >
        {label}
        {required && <span className="text-status-red"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        required={required}
        aria-invalid={error ? "true" : undefined}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-status-blue focus:outline-none aria-[invalid=true]:border-status-red"
        {...inputProps}
      />
      {error && (
        <p role="alert" className="mt-1 text-[0.65rem] text-status-red">
          {error}
        </p>
      )}
    </div>
  );
}

function FieldSelect({
  name,
  label,
  error,
  required,
  children,
}: {
  name: string;
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
      >
        {label}
        {required && <span className="text-status-red"> *</span>}
      </label>
      <select
        id={name}
        name={name}
        required={required}
        aria-invalid={error ? "true" : undefined}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-status-blue focus:outline-none aria-[invalid=true]:border-status-red"
      >
        {children}
      </select>
      {error && (
        <p role="alert" className="mt-1 text-[0.65rem] text-status-red">
          {error}
        </p>
      )}
    </div>
  );
}
