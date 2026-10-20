"use client";

import { useActionState, useEffect, useState } from "react";

import {
  createAircraftAction,
  type FleetActionState,
} from "@/app/(app)/settings/fleet/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

export function AddAircraftDialog() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FleetActionState, FormData>(
    createAircraftAction,
    { status: "idle" },
  );

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
        className="inline-flex items-center gap-1.5 rounded-md bg-brand-primary px-3 py-2 text-xs font-semibold text-white hover:bg-brand-primary-dark"
      >
        + Add Aircraft
      </button>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Add an aircraft</DialogTitle>
            <DialogDescription>
              Tail number and seats are the required fields for a Part 135
              certificated airframe. Optional metadata can be back-filled later.
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

            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                name="tail_number"
                label="Tail number"
                placeholder="N300PA"
                required
                autoCapitalize="characters"
                spellCheck={false}
                error={fieldError("tail_number")}
              />
              <Field
                name="model"
                label="Model"
                placeholder="Pilatus PC-12"
                className="sm:col-span-2"
                error={fieldError("model")}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                name="seats"
                label="Seats"
                type="number"
                min={1}
                max={999}
                required
                error={fieldError("seats")}
              />
              <Field
                name="max_payload_lbs"
                label="Useful load (lbs)"
                type="number"
                min={0}
                max={200_000}
                error={fieldError("max_payload_lbs")}
              />
              <Field
                name="base"
                label="Home base ICAO"
                placeholder="PANC"
                autoCapitalize="characters"
                spellCheck={false}
                error={fieldError("base")}
              />
            </div>

            {/* HALT-2 — airframe identity. Grouped as its own row because
                these three read together on the fleet card:
                "2019 Cessna 208 Caravan · S/N 208B1234". */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                name="year"
                label="Year"
                type="number"
                min={1903}
                max={2100}
                placeholder="2019"
                error={fieldError("year")}
              />
              <Field
                name="make"
                label="Make"
                placeholder="Cessna"
                error={fieldError("make")}
              />
              <Field
                name="serial_number"
                label="Serial number"
                placeholder="208B1234"
                autoCapitalize="characters"
                spellCheck={false}
                error={fieldError("serial_number")}
              />
            </div>

            <Field
              name="airframe_type"
              label="Airframe slug (optional)"
              placeholder="caravan"
              spellCheck={false}
              error={fieldError("airframe_type")}
            />

            <div>
              <label
                htmlFor="special_notes"
                className="field-label"
              >
                Special notes
              </label>
              <textarea
                id="special_notes"
                name="special_notes"
                rows={2}
                maxLength={200}
                placeholder="Commuter seats · VIP interior · STC dual-pilot only"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
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
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-primary px-4 py-2 text-xs font-semibold text-white hover:bg-brand-primary-dark disabled:opacity-60"
              >
                {pending && <Spinner size="xs" />}
                {pending ? "Adding…" : "Add aircraft"}
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
  className = "",
  ...inputProps
}: React.InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  label: string;
  error?: string;
}) {
  return (
    <div className={className}>
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
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none aria-[invalid=true]:border-status-red"
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
