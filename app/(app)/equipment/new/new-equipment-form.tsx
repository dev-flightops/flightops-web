"use client";

import { useActionState } from "react";

import { Spinner } from "@/components/ui/spinner";
import type { GSEUnitListItem, StationListItem } from "@/lib/api/types";

import type { EquipmentFormState } from "../equipment-schema";
import { createEquipmentAction } from "./actions";

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

/** Add Equipment, or with `unit` and its update action, Edit (#134). */
export function NewEquipmentForm({
  stations,
  unit,
  submit = createEquipmentAction,
}: {
  stations: StationListItem[];
  /** The unit being edited: its values fill the form. */
  unit?: GSEUnitListItem;
  submit?: (prev: EquipmentFormState, form: FormData) => Promise<EquipmentFormState>;
}) {
  const [state, action, pending] = useActionState<
    EquipmentFormState,
    FormData
  >(submit, { status: "idle" });
  const value = (v: string | number | null | undefined) => (v === null || v === undefined ? undefined : String(v));
  // The unit's own station is always offered, so a station list that failed
  // to load can't turn into "Unassigned" on save.
  const current = unit?.station ?? null;
  const stationOptions =
    current && !stations.some((s) => s.id === current.id)
      ? [{ id: current.id, icao_code: current.icao_code, name: current.name }, ...stations]
      : stations;

  const fieldError = (key: string) =>
    state.status === "field-errors" ? state.errors[key] : undefined;

  return (
    <form action={action} className="space-y-4">
      {state.status === "api-error" && (
        <div
          role="alert"
          className="notice notice-red"
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
          defaultValue={value(unit?.name)}
          error={fieldError("name")}
        />
        <FieldSelect
          name="equipment_type"
          label="Equipment Type"
          defaultValue={unit?.equipment_type ?? "tug"}
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
          defaultValue={value(unit?.make)}
          error={fieldError("make")}
        />
        <Field
          name="model"
          label="Model"
          placeholder="TT-50"
          defaultValue={value(unit?.model)}
          error={fieldError("model")}
        />
        <Field
          name="year"
          label="Year"
          type="number"
          placeholder="2018"
          defaultValue={value(unit?.year)}
          error={fieldError("year")}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field
          name="serial_number"
          label="Serial #"
          placeholder="EA-12345"
          defaultValue={value(unit?.serial_number)}
          error={fieldError("serial_number")}
        />
        <Field
          name="manufacturer"
          label="Manufacturer"
          placeholder="Eagle Industries"
          defaultValue={value(unit?.manufacturer)}
          error={fieldError("manufacturer")}
        />
      </div>

      <FieldSelect
        name="station_id"
        label="Assigned Station (optional)"
        defaultValue={unit?.station?.id ?? ""}
        error={fieldError("station_id")}
      >
        <option value="">— Unassigned —</option>
        {stationOptions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.icao_code} · {s.name}
          </option>
        ))}
      </FieldSelect>

      <div className="grid grid-cols-3 gap-4">
        <Field
          name="hours_total"
          label="Hours (current)"
          type="number"
          step="0.1"
          placeholder="0"
          defaultValue={value(unit?.hours_total) ?? "0"}
          error={fieldError("hours_total")}
        />
        <Field
          name="service_interval_days"
          label="Service interval (days)"
          type="number"
          placeholder="90"
          defaultValue={value(unit?.service_interval_days)}
          error={fieldError("service_interval_days")}
        />
        <Field
          name="next_service_date"
          label="Next service"
          type="date"
          defaultValue={value(unit?.next_service_date)}
          error={fieldError("next_service_date")}
        />
      </div>

      <div>
        <label
          htmlFor="notes"
          className="field-label"
        >
          Notes (optional)
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={2000}
          defaultValue={value(unit?.notes)}
          placeholder="Special handling notes, purchase context, etc."
          className="ff-input px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="btn-caps inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {pending && <Spinner size="xs" />}
        {unit
          ? pending
            ? "Saving…"
            : "Save changes"
          : pending
            ? "Adding equipment…"
            : "Add equipment"}
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
        className="field-label"
      >
        {label}
        {inputProps.required && <span className="text-status-red"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        aria-invalid={error ? "true" : undefined}
        className="ff-input px-3 py-2 text-sm aria-[invalid=true]:border-status-red"
        {...inputProps}
      />
      {error && (
        <p role="alert" className="field-error">
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
        className="field-label"
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
        className="ff-input px-3 py-2 text-sm aria-[invalid=true]:border-status-red"
      >
        {children}
      </select>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
