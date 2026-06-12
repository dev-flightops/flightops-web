"use client";

import { useActionState } from "react";

import { Spinner } from "@/components/ui/spinner";

import { createStationAction, type NewStationState } from "./actions";

/**
 * Add Station form — full set of Station fields exposed by the
 * backend (M2-M-25a). Lays out as a two-column responsive grid with
 * the ICAO + Name pair on the first row and the optional metadata
 * below. Submit calls the server action, which redirects to the new
 * station's detail page on success.
 */
export function NewStationForm() {
  const [state, action, pending] = useActionState<NewStationState, FormData>(
    createStationAction,
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

      <div className="grid grid-cols-2 gap-4">
        <Field
          name="icao_code"
          label="ICAO Code"
          placeholder="PANC"
          required
          autoCapitalize="characters"
          spellCheck={false}
          error={fieldError("icao_code")}
        />
        <Field
          name="name"
          label="Name"
          placeholder="Ted Stevens Anchorage Intl"
          required
          error={fieldError("name")}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field
          name="city"
          label="City"
          placeholder="Anchorage"
          error={fieldError("city")}
        />
        <Field
          name="state"
          label="State"
          placeholder="AK"
          error={fieldError("state")}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field
          name="elevation_ft"
          label="Elevation (ft)"
          type="number"
          placeholder="152"
          error={fieldError("elevation_ft")}
        />
        <Field
          name="latitude"
          label="Latitude"
          type="number"
          step="0.0001"
          placeholder="61.1742"
          error={fieldError("latitude")}
        />
        <Field
          name="longitude"
          label="Longitude"
          type="number"
          step="0.0001"
          placeholder="-149.9962"
          error={fieldError("longitude")}
        />
      </div>

      <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card/40 px-3 py-2 text-xs text-foreground">
        <input
          type="checkbox"
          name="has_reporting_function"
          defaultChecked
          className="h-4 w-4 cursor-pointer accent-status-blue"
        />
        <span>Reporting station — generates EOD activity reports</span>
      </label>

      <div>
        <label
          htmlFor="notes"
          className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
        >
          Notes (optional)
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={2000}
          placeholder="Operational notes — runway condition flags, ramp restrictions, etc."
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-blue focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-status-blue px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
      >
        {pending && <Spinner size="xs" />}
        {pending ? "Adding station…" : "Add station"}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  error,
  type = "text",
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
        {inputProps.required && <span className="text-status-red"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        aria-invalid={error ? "true" : undefined}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-blue focus:outline-none aria-[invalid=true]:border-status-red"
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
