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
import type { FuelTypeResponse } from "@/lib/api/types";

import {
  createFuelQualityTestAction,
  type FuelQualityActionState,
} from "@/app/(app)/fuel/quality/actions";

const TEST_KINDS: { value: string; label: string }[] = [
  { value: "sump", label: "Sump check (aircraft preflight)" },
  { value: "supplier_bulk", label: "Supplier bulk receipt" },
  { value: "tank_calibration", label: "Tank calibration" },
  { value: "other", label: "Other" },
];

export function AddFuelQualityTestDialog({
  fuelTypes,
}: {
  fuelTypes: FuelTypeResponse[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<
    FuelQualityActionState,
    FormData
  >(createFuelQualityTestAction, { status: "idle" });

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
        className="btn-caps inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-white hover:bg-brand-dark text-[0.72rem]"
      >
        + Log Test
      </button>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Log a fuel quality test</DialogTitle>
            <DialogDescription>
              Part 135 compliance log — water + particulate flags are the
              key fields. The server derives the pass/fail bucket from
              those two checkboxes.
            </DialogDescription>
          </DialogHeader>

          <form action={action} className="space-y-4">
            {state.status === "api-error" && (
              <div
                role="alert"
                className="notice notice-red"
              >
                {state.message}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                name="base_code"
                label="Base"
                placeholder="PANC"
                required
                autoCapitalize="characters"
                spellCheck={false}
                error={fieldError("base_code")}
              />
              <Field
                name="n_number"
                label="Aircraft tail (optional)"
                placeholder="N207GE"
                autoCapitalize="characters"
                spellCheck={false}
                error={fieldError("n_number")}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                name="test_kind"
                label="Test kind"
                required
                defaultValue="sump"
                options={TEST_KINDS}
                error={fieldError("test_kind")}
              />
              <Select
                name="fuel_type_id"
                label="Fuel type (optional)"
                defaultValue=""
                options={[
                  { value: "", label: "— Pick if known —" },
                  ...fuelTypes.map((t) => ({
                    value: t.id,
                    label: t.label,
                  })),
                ]}
                error={fieldError("fuel_type_id")}
              />
            </div>

            <fieldset className="space-y-2 rounded-md border border-border bg-card/40 p-4">
              <legend className="px-1 eyebrow">
                Findings
              </legend>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  name="water_detected"
                  className="h-4 w-4 rounded border-border bg-background text-status-red focus:ring-status-red"
                />
                Water detected in sample
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  name="particulates_detected"
                  className="h-4 w-4 rounded border-border bg-background text-status-red focus:ring-status-red"
                />
                Particulates / sediment detected
              </label>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                name="sample_volume_oz"
                label="Sample volume (oz)"
                type="number"
                step="0.1"
                min={0}
                placeholder="8"
                error={fieldError("sample_volume_oz")}
              />
              <Field
                name="ambient_temp_c"
                label="Ambient temp (°C)"
                type="number"
                placeholder="-5"
                min={-90}
                max={60}
                error={fieldError("ambient_temp_c")}
              />
            </div>

            <div>
              <label
                htmlFor="notes"
                className="field-label"
              >
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                maxLength={2000}
                placeholder="e.g. clear sample, no findings; or describe contamination signs"
                className="ff-input px-3 py-2 text-sm"
              />
            </div>

            <DialogFooter>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="btn-caps rounded-md border border-input px-3 py-2 text-foreground hover:bg-accent text-[0.72rem]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="btn-caps inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-white hover:bg-brand-dark disabled:opacity-60 text-[0.72rem]"
              >
                {pending && <Spinner size="xs" />}
                {pending ? "Logging…" : "Log test"}
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
        className="field-label"
      >
        {label}
        {inputProps.required && <span className="text-status-red"> *</span>}
      </label>
      <input
        id={name}
        name={name}
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
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
