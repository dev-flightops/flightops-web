"use client";

import { useActionState, useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import type { VillageAirportResponse } from "@/lib/api/types";

import {
  fileVillageReportAction,
  type VillageActionState,
} from "@/app/(app)/village-wx/actions";

const CLOUD_COVERS: { value: string; label: string }[] = [
  { value: "", label: "— Pick if known —" },
  { value: "SKC", label: "SKC — sky clear" },
  { value: "CLR", label: "CLR — clear below 12k" },
  { value: "FEW", label: "FEW — few" },
  { value: "SCT", label: "SCT — scattered" },
  { value: "BKN", label: "BKN — broken" },
  { value: "OVC", label: "OVC — overcast" },
  { value: "VV", label: "VV — vertical visibility" },
];

export function AddReportDialog({
  airports,
  defaultAirportId,
}: {
  airports: VillageAirportResponse[];
  defaultAirportId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<
    VillageActionState,
    FormData
  >(fileVillageReportAction, { status: "idle" });

  useEffect(() => {
    if (state.status === "ok") setOpen(false);
  }, [state.status]);

  const fieldError = (key: string) =>
    state.status === "field-errors" ? state.errors[key] : undefined;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={airports.length === 0}
        title={
          airports.length === 0 ? "Add an airport first" : undefined
        }
        className="inline-flex items-center gap-1.5 rounded-md bg-status-blue px-3 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        + Add Report
      </button>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>File a village weather report</DialogTitle>
            <DialogDescription>
              Quick observation — only the airport is required. Fill the
              fields you actually know; the server stamps the flight
              category (VFR / MVFR / IFR / LIFR) from ceiling + visibility.
            </DialogDescription>
          </DialogHeader>

          <form action={action} className="space-y-4">
            {state.status === "api-error" && (
              <div
                role="alert"
                className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
              >
                {state.message}
              </div>
            )}

            <Select
              name="village_airport_id"
              label="Airport"
              required
              defaultValue={defaultAirportId ?? ""}
              error={fieldError("village_airport_id")}
              options={[
                { value: "", label: "— Select airport —" },
                ...airports.map((a) => ({
                  value: a.id,
                  label: `${a.icao} — ${a.name}`,
                })),
              ]}
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <Select
                name="cloud_cover"
                label="Cloud cover"
                options={CLOUD_COVERS}
                error={fieldError("cloud_cover")}
              />
              <Field
                name="ceiling_ft"
                label="Ceiling (ft AGL)"
                type="number"
                placeholder="1000"
                min={0}
                max={50000}
                error={fieldError("ceiling_ft")}
              />
              <Field
                name="visibility_sm"
                label="Visibility (SM)"
                type="number"
                step="0.25"
                placeholder="3"
                min={0}
                max={99}
                error={fieldError("visibility_sm")}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                name="wind_dir_deg"
                label="Wind direction (°)"
                type="number"
                placeholder="180"
                min={0}
                max={360}
                error={fieldError("wind_dir_deg")}
              />
              <Field
                name="wind_speed_kt"
                label="Wind speed (kt)"
                type="number"
                placeholder="12"
                min={0}
                max={200}
                error={fieldError("wind_speed_kt")}
              />
              <Field
                name="wind_gust_kt"
                label="Wind gust (kt)"
                type="number"
                placeholder="18"
                min={0}
                max={200}
                error={fieldError("wind_gust_kt")}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                name="temperature_c"
                label="Temperature (°C)"
                type="number"
                placeholder="-5"
                min={-90}
                max={60}
                error={fieldError("temperature_c")}
              />
              <Field
                name="altimeter_in_hg"
                label="Altimeter (inHg)"
                type="number"
                step="0.01"
                placeholder="29.92"
                min={25}
                max={33}
                error={fieldError("altimeter_in_hg")}
              />
            </div>

            <div>
              <label
                htmlFor="notes"
                className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
              >
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={2}
                placeholder="Light snow showers; runway packed"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-blue focus:outline-none"
              />
            </div>

            <DialogFooter>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-md bg-status-blue px-4 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
              >
                {pending && <Spinner size="xs" />}
                {pending ? "Filing…" : "File report"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
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
        {inputProps.required && <span className="text-status-red"> *</span>}
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

function Select({
  name,
  label,
  required,
  defaultValue,
  options,
  error,
}: {
  name: string;
  label: string;
  required?: boolean;
  defaultValue?: string;
  options: readonly { value: string; label: string }[];
  error?: string;
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
        defaultValue={defaultValue}
        required={required}
        aria-invalid={error ? "true" : undefined}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-blue focus:outline-none aria-[invalid=true]:border-status-red"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="mt-1 text-[0.65rem] text-status-red">
          {error}
        </p>
      )}
    </div>
  );
}
