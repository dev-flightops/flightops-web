"use client";

import { useActionState } from "react";

import { Spinner } from "@/components/ui/spinner";
import type {
  FuelSupplierResponse,
  FuelTypeResponse,
} from "@/lib/api/types";

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
}: {
  suppliers: FuelSupplierResponse[];
  fuelTypes: FuelTypeResponse[];
}) {
  const [state, action, pending] = useActionState<NewFuelOrderState, FormData>(
    createFuelOrderAction,
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
          name="n_number"
          label="Tail Number"
          placeholder="N207GE"
          required
          autoCapitalize="characters"
          spellCheck={false}
          error={fieldError("n_number")}
        />
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
          {fuelTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </FieldSelect>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field
          name="requested_quantity_gallons"
          label="Gallons"
          type="number"
          step="0.1"
          min={0}
          placeholder="100"
          required
          error={fieldError("requested_quantity_gallons")}
        />
        <Field
          name="requested_fuel_date"
          label="Requested Date"
          type="date"
          defaultValue={todayLocalIsoDate()}
          required
          error={fieldError("requested_fuel_date")}
        />
      </div>

      <div>
        <label
          htmlFor="special_instructions"
          className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
        >
          Special instructions (optional)
        </label>
        <textarea
          id="special_instructions"
          name="special_instructions"
          rows={3}
          maxLength={2000}
          placeholder="e.g. north ramp; contact captain before fueling"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-blue focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={pending || suppliers.length === 0 || fuelTypes.length === 0}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-status-blue px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
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
  required,
  error,
  children,
}: {
  name: string;
  label: string;
  required?: boolean;
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
        {required && <span className="text-status-red"> *</span>}
      </label>
      <select
        id={name}
        name={name}
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
