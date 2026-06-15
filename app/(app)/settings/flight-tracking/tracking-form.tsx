"use client";

import { useActionState } from "react";

import { Spinner } from "@/components/ui/spinner";
import type { FlightTrackingConfigResponse } from "@/lib/api/types";

import {
  updateFlightTrackingAction,
  type UpdateTrackingState,
} from "./actions";

export function TrackingForm({
  config,
}: {
  config: FlightTrackingConfigResponse;
}) {
  const [state, action, pending] = useActionState<
    UpdateTrackingState,
    FormData
  >(updateFlightTrackingAction, { status: "idle" });

  const fieldError = (key: string) =>
    state.status === "field-errors" ? state.errors[key] : undefined;

  return (
    <form action={action} className="space-y-6">
      {state.status === "api-error" && (
        <div
          role="alert"
          className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
        >
          {state.message}
        </div>
      )}
      {state.status === "saved" && (
        <div
          role="status"
          className="rounded-md border border-status-green/40 bg-status-green/10 px-3 py-2 text-xs text-status-green"
        >
          Saved.
        </div>
      )}

      <fieldset className="space-y-4 rounded-lg border border-border bg-card p-5">
        <legend className="px-2 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Thresholds
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            name="overdue_threshold_minutes"
            label="Overdue alert"
            suffix="min"
            min={1}
            max={240}
            defaultValue={config.overdue_threshold_minutes}
            hint="Dispatcher alert when a flight's ETA passes without an arrival ack. Default 20."
            error={fieldError("overdue_threshold_minutes")}
          />
          <NumberField
            name="position_polling_seconds"
            label="Position polling"
            suffix="sec"
            min={5}
            max={600}
            defaultValue={config.position_polling_seconds}
            hint="How aggressively the fleet map re-polls position data. Default 30."
            error={fieldError("position_polling_seconds")}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-lg border border-border bg-card p-5">
        <legend className="px-2 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Provider
        </legend>

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            name="simulation_mode_enabled"
            defaultChecked={config.simulation_mode_enabled}
            className="h-4 w-4 rounded border-border bg-background text-status-blue focus:ring-status-blue"
          />
          Simulation mode (flips the SIMULATION-MODE banner on the map)
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="spider_tracks_aff_email"
            label="Spider Tracks AFF email"
            type="email"
            placeholder="aff@operator.example"
            defaultValue={config.spider_tracks_aff_email ?? ""}
            error={fieldError("spider_tracks_aff_email")}
          />
          <Field
            name="spider_tracks_aff_endpoint"
            label="Spider Tracks AFF endpoint"
            placeholder="https://aff.spidertracks.com/..."
            defaultValue={config.spider_tracks_aff_endpoint ?? ""}
            error={fieldError("spider_tracks_aff_endpoint")}
          />
        </div>
        <p className="text-[0.7rem] text-muted-foreground">
          When both Spider Tracks fields are populated, the integration falls
          back to live position data; simulation mode auto-flips off.
        </p>
      </fieldset>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-status-blue px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
        >
          {pending && <Spinner size="xs" />}
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function NumberField({
  name,
  label,
  suffix,
  hint,
  error,
  ...inputProps
}: React.InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  label: string;
  suffix?: string;
  hint?: string;
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
      <div className="flex items-stretch overflow-hidden rounded-md border border-border bg-background focus-within:border-status-blue">
        <input
          id={name}
          name={name}
          type="number"
          aria-invalid={error ? "true" : undefined}
          className="flex-1 bg-transparent px-3 py-2 text-sm text-foreground focus:outline-none"
          {...inputProps}
        />
        {suffix && (
          <span className="flex items-center bg-muted/30 px-3 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {hint && (
        <p className="mt-1 text-[0.65rem] text-muted-foreground">{hint}</p>
      )}
      {error && (
        <p role="alert" className="mt-1 text-[0.65rem] text-status-red">
          {error}
        </p>
      )}
    </div>
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
