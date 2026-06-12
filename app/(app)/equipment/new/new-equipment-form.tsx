"use client";

import { useActionState } from "react";

import { Spinner } from "@/components/ui/spinner";
import type { StationListItem } from "@/lib/api/types";

import {
  createEquipmentAction,
  type NewEquipmentState,
} from "./actions";

const EQUIPMENT_TYPES = [
  { value: "tug", label: "Tug" },
  { value: "gpu", label: "GPU" },
  { value: "deice_truck", label: "Deice truck" },
  { value: "belt_loader", label: "Belt loader" },
  { value: "fuel_truck", label: "Fuel truck" },
  { value: "lavatory", label: "Lavatory" },
  { value: "air_start", label: "Air start" },
  { value: "heater", label: "Heater" },
  { value: "other", label: "Other" },
] as const;

export function NewEquipmentForm({
  stations,
}: {
  stations: StationListItem[];
}) {
  const [state, action, pending] = useActionState<
    NewEquipmentState,
    FormData
  >(createEquipmentAction, { status: "idle" });

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
          name="name"
          label="Name"
          placeholder="Tug A-12"
          required
          error={fieldError("name")}
        />
        <FieldSelect
          name="equipment_type"
          label="Equipment Type"
          defaultValue="tug"
          required
          error={fieldError("equipment_type")}
        >
          {EQUIPMENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </FieldSelect>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field
          name="make"
          label="Make"
          placeholder="Eagle"
          error={fieldError("make")}
        />
        <Field
          name="model"
          label="Model"
          placeholder="TT-50"
          error={fieldError("model")}
        />
        <Field
          name="year"
          label="Year"
          type="number"
          placeholder="2018"
          error={fieldError("year")}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field
          name="serial_number"
          label="Serial #"
          placeholder="EA-12345"
          error={fieldError("serial_number")}
        />
        <Field
          name="manufacturer"
          label="Manufacturer"
          placeholder="Eagle Industries"
          error={fieldError("manufacturer")}
        />
      </div>

      <FieldSelect
        name="station_id"
        label="Assigned Station (optional)"
        defaultValue=""
        error={fieldError("station_id")}
      >
        <option value="">— Unassigned —</option>
        {stations.map((s) => (
          <option key={s.id} value={s.id}>
            {s.icao_code} · {s.name}
          </option>
        ))}
      </FieldSelect>

      <div className="grid grid-cols-2 gap-4">
        <Field
          name="hours_total"
          label="Hours (current)"
          type="number"
          step="0.1"
          placeholder="0"
          defaultValue="0"
          error={fieldError("hours_total")}
        />
        <Field
          name="service_interval_days"
          label="Service interval (days)"
          type="number"
          placeholder="90"
          error={fieldError("service_interval_days")}
        />
      </div>

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
          placeholder="Special handling notes, purchase context, etc."
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-blue focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-status-blue px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
      >
        {pending && <Spinner size="xs" />}
        {pending ? "Adding equipment…" : "Add equipment"}
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
        defaultValue={defaultValue}
        required={required}
        aria-invalid={error ? "true" : undefined}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-blue focus:outline-none aria-[invalid=true]:border-status-red"
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
