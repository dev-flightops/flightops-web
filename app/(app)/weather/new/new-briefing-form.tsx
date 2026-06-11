"use client";

import { useActionState } from "react";

import { Spinner } from "@/components/ui/spinner";
import type { AircraftListItem, FlightListItem } from "@/lib/api/types";

import {
  createBriefingAction,
  type NewBriefingState,
} from "./actions";

/**
 * "New Weather Briefing" form (M2-G-27).
 *
 * Free-form ICAO input (whitespace / commas — parser drops bogus
 * tokens, dedupes, uppercases), optional flight + aircraft picker for
 * audit context, free-form dispatcher notes.
 *
 * Submit calls createBriefingAction → POST /weather/briefings →
 * redirect /weather/{id}. While the action is in flight the button
 * disables and shows a spinner — backend fans out to AWC for METAR +
 * TAF, so this can take a second or two on cold cache.
 */
export function NewBriefingForm({
  aircraft,
  flights,
}: {
  aircraft: AircraftListItem[];
  flights: FlightListItem[];
}) {
  const [state, action, pending] = useActionState<NewBriefingState, FormData>(
    createBriefingAction,
    { status: "idle" },
  );

  const fieldError = (key: string) =>
    state.status === "field-errors" ? state.errors[key] : undefined;

  return (
    <form action={action} className="space-y-4">
      {state.status === "api-error" && (
        <div
          role="alert"
          className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
        >
          {state.message}
        </div>
      )}

      <Field
        name="airports_raw"
        label="Airports (ICAO codes, space or comma separated)"
        placeholder="PANC PAEN PADU"
        required
        autoCapitalize="characters"
        spellCheck={false}
        error={fieldError("airports_raw")}
        hint="Origin · destination · alternates. Up to 10 airports."
      />

      <div className="grid grid-cols-2 gap-4">
        <FieldSelect
          name="flight_id"
          label="Flight (optional)"
          error={fieldError("flight_id")}
        >
          <option value="">— None —</option>
          {flights.map((f) => (
            <option key={f.id} value={f.id}>
              {f.flight_number} · {f.aircraft.tail_number} · {f.origin}→
              {f.destination}
            </option>
          ))}
        </FieldSelect>
        <FieldSelect
          name="aircraft_id"
          label="Aircraft (optional)"
          error={fieldError("aircraft_id")}
        >
          <option value="">— None —</option>
          {aircraft.map((a) => (
            <option key={a.id} value={a.id}>
              {a.tail_number} — {a.model}
            </option>
          ))}
        </FieldSelect>
      </div>

      <div>
        <label
          htmlFor="dispatcher_notes"
          className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
        >
          Dispatcher notes (optional)
        </label>
        <textarea
          id="dispatcher_notes"
          name="dispatcher_notes"
          rows={4}
          maxLength={2000}
          placeholder="Any relevant operational notes…"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-blue focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-status-blue px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
      >
        {pending && <Spinner size="xs" />}
        {pending
          ? "Fetching weather…"
          : "Fetch Weather & Create Briefing"}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  error,
  hint,
  ...inputProps
}: React.InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  label: string;
  error?: string;
  hint?: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
      >
        {label}
        {inputProps.required && <span className="text-status-red"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        aria-invalid={error ? "true" : undefined}
        className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground focus:border-status-blue focus:outline-none aria-[invalid=true]:border-status-red"
        {...inputProps}
      />
      {hint && !error && (
        <p className="mt-1 text-[0.65rem] text-muted-foreground/70">{hint}</p>
      )}
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
  children,
}: {
  name: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
      >
        {label}
      </label>
      <select
        id={name}
        name={name}
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
