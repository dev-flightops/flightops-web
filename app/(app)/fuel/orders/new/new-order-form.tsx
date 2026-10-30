"use client";

import { useActionState, useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import type {
  AircraftListItem,
  FuelSupplierResponse,
  FuelTypeResponse,
} from "@/lib/api/types";
import { takesFuel } from "@/lib/fuel";

import { createFuelOrderAction, type NewFuelOrderState } from "./actions";

function todayLocalIsoDate(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

export function NewFuelOrderForm({
  suppliers,
  fuelTypes,
  fleet,
}: {
  suppliers: FuelSupplierResponse[];
  fuelTypes: FuelTypeResponse[];
  /** The aircraft in service (#156): the tail is picked from them. */
  fleet: AircraftListItem[];
}) {
  const [state, action, pending] = useActionState<NewFuelOrderState, FormData>(
    createFuelOrderAction,
    { status: "idle" },
  );

  // M2-C-3 — live-total display next to the Left / Right inputs.
  // Pilots type per side to manage lateral balance ("50 gal per side"
  // is the common ask); the total is derived, not entered.
  const [leftGal, setLeftGal] = useState<string>("");
  const [rightGal, setRightGal] = useState<string>("");
  const parseGal = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  const totalGal = parseGal(leftGal) + parseGal(rightGal);

  // #156: "Form should only offer the aircraft's fuel." The tail picks the
  // fuel; its tanks bound the quantity.
  const [tail, setTail] = useState<string>("");
  const aircraft = fleet.find((a) => a.tail_number === tail) ?? null;
  const offered = aircraft
    ? fuelTypes.filter((t) => takesFuel(aircraft.effective_fuel_type_code, t.code))
    : fuelTypes;
  const capacity = aircraft?.effective_fuel_capacity_gal ?? null;
  const overCapacity = capacity !== null && totalGal > capacity;

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
        <FieldSelect
          name="n_number"
          label="Aircraft"
          required
          error={fieldError("n_number")}
          value={tail}
          onChange={setTail}
          hint={
            aircraft
              ? `${aircraft.model ?? aircraft.tail_number}${capacity !== null ? ` · tanks hold ${capacity} gal` : ""}`
              : undefined
          }
        >
          <option value="">— Select aircraft —</option>
          {fleet.map((a) => (
            <option key={a.id} value={a.tail_number}>
              {a.tail_number}
            </option>
          ))}
        </FieldSelect>
        <Field
          name="base_code"
          label="Base"
          placeholder="PANC"
          required
          autoCapitalize="characters"
          spellCheck={false}
          error={fieldError("base_code")}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FieldSelect
          name="supplier_id"
          label="Supplier"
          required
          error={fieldError("supplier_id")}
        >
          <option value="">— Select supplier —</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </FieldSelect>
        <FieldSelect
          name="fuel_type_id"
          label="Fuel Type"
          required
          error={fieldError("fuel_type_id")}
        >
          <option value="">— Select type —</option>
          {offered.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </FieldSelect>
      </div>

      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <span className="eyebrow">
            Gallons per side <span className="text-status-red">*</span>
          </span>
          <span
            aria-live="polite"
            className="text-[0.65rem] font-mono text-muted-foreground"
          >
            Total: <span className="font-semibold text-foreground">{totalGal.toFixed(1)}</span> gal
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SideInput
            name="requested_left_gallons"
            label="Left"
            value={leftGal}
            onChange={setLeftGal}
            error={fieldError("requested_left_gallons")}
          />
          <SideInput
            name="requested_right_gallons"
            label="Right"
            value={rightGal}
            onChange={setRightGal}
          />
        </div>
        <p className="mt-1 text-[0.6rem] text-muted-foreground">
          Enter each wing tank separately — the total is calculated. Enter 0 on
          one side if you only want to fill the other.
        </p>
        {overCapacity ? (
          <p role="alert" className="field-error">
            {totalGal.toFixed(1)} gal is more than {tail}&apos;s tanks hold ({capacity} gal).
          </p>
        ) : null}
      </div>

      <Field
        name="requested_fuel_date"
        label="Requested Date"
        type="date"
        defaultValue={todayLocalIsoDate()}
        required
        error={fieldError("requested_fuel_date")}
      />

      <div>
        <label
          htmlFor="special_instructions"
          className="field-label"
        >
          Special instructions (optional)
        </label>
        <textarea
          id="special_instructions"
          name="special_instructions"
          rows={3}
          maxLength={2000}
          placeholder="e.g. north ramp; contact captain before fueling"
          className="ff-input px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={pending || suppliers.length === 0 || fuelTypes.length === 0 || overCapacity}
        className="btn-caps inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {pending && <Spinner size="xs" />}
        {pending ? "Placing order…" : "Place fuel order"}
      </button>

      {(suppliers.length === 0 || fuelTypes.length === 0) && (
        <p className="text-center text-[0.7rem] text-status-yellow">
          Configure at least one supplier and fuel type before placing an
          order.
        </p>
      )}
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

function SideInput({
  name,
  label,
  value,
  onChange,
  error,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="field-label"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="number"
        step="0.1"
        min={0}
        placeholder="50"
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? "true" : undefined}
        className="ff-input px-3 py-2 text-sm aria-[invalid=true]:border-status-red"
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
  required,
  error,
  hint,
  value,
  onChange,
  children,
}: {
  name: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  value?: string;
  onChange?: (value: string) => void;
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
        required={required}
        aria-invalid={error ? "true" : undefined}
        className="ff-input px-3 py-2 text-sm aria-[invalid=true]:border-status-red"
        {...(onChange ? { value, onChange: (e) => onChange(e.target.value) } : {})}
      >
        {children}
      </select>
      {hint && !error ? <p className="mt-1 text-[0.65rem] text-muted-foreground">{hint}</p> : null}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
