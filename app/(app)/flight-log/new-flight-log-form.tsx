"use client";

import { useActionState } from "react";

import { Spinner } from "@/components/ui/spinner";
import type { AircraftListItem, FlightListItem } from "@/lib/api/types";

import {
  createFlightLogAction,
  type CreateFlightLogState,
} from "./actions";

/**
 * "New Flight Log" form on the elog landing (M2-G-26b).
 *
 * Four fields mirroring legacy `templates/elog/log_page.html` form:
 *   Aircraft *      — required select (active aircraft only)
 *   Flight          — optional select; "Manual entry" leaves it null,
 *                     otherwise binds the log to a released Flight row
 *   Flight Number   — auto-fills from the picked Flight; the pilot
 *                     can override for ferry / repositioning legs
 *   Flight Type     — advisory / charter / training / ferry / other
 *
 * Submit calls createFlightLogAction → backend → redirect to
 * /flight-log/{id} (stub until M3 ships the 7-tab detail).
 */
export function NewFlightLogForm({
  aircraft,
  recentFlights,
}: {
  aircraft: AircraftListItem[];
  /** Released-but-not-completed flights the pilot can choose from.
   *  Pulled by the page once; we present them in the dropdown but
   *  don't filter by aircraft here — the backend rejects mismatches
   *  with a clear error message. */
  recentFlights: FlightListItem[];
}) {
  const [state, action, pending] = useActionState<
    CreateFlightLogState,
    FormData
  >(createFlightLogAction, { status: "idle" });

  const fieldError = (key: string) =>
    state.status === "field-errors" ? state.errors[key] : undefined;

  return (
    <form action={action} className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        New Flight Log
      </h2>

      {state.status === "api-error" && (
        <div
          role="alert"
          className="mb-3 rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
        >
          {state.message}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-4">
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

        <FieldSelect
          name="flight_id"
          label="Flight"
          error={fieldError("flight_id")}
        >
          <option value="">Manual entry</option>
          {recentFlights.map((f) => (
            <option key={f.id} value={f.id}>
              {f.flight_number} · {f.aircraft.tail_number} · {f.origin}→
              {f.destination}
            </option>
          ))}
        </FieldSelect>

        <Field
          name="flight_number"
          label="Flight Number"
          placeholder="GV101"
          maxLength={12}
          error={fieldError("flight_number")}
        />

        <FieldSelect
          name="flight_type"
          label="Flight Type"
          defaultValue="advisory"
          error={fieldError("flight_type")}
        >
          <option value="advisory">Advisory Flight</option>
          <option value="charter">Charter</option>
          <option value="training">Training</option>
          <option value="ferry">Ferry</option>
          <option value="other">Other</option>
        </FieldSelect>
      </div>

      <div className="mt-4">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-status-blue px-4 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50"
        >
          {pending && <Spinner size="xs" />}
          {pending ? "Starting…" : "Start Flight Log"}
        </button>
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  error,
  ...inputProps
}: React.InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  label: string;
  error?: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
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
  defaultValue,
  children,
}: {
  name: string;
  label: string;
  error?: string;
  required?: boolean;
  defaultValue?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
      >
        {label}
        {required && <span className="text-status-red"> *</span>}
      </label>
      <select
        id={name}
        name={name}
        required={required}
        defaultValue={defaultValue}
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
