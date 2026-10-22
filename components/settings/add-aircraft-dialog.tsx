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
        className="btn-caps inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-white hover:bg-brand-dark text-[0.72rem]"
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
                label="Passenger seats"
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
            <p className="-mt-2 text-xs text-muted-foreground">
              Passenger seats leave out the pilot&rsquo;s and co-pilot&rsquo;s seats. Useful load is
              the max gross weight less the empty weight.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                name="max_gross_weight_lbs"
                label="Max gross weight (lbs)"
                type="number"
                min={1}
                max={200_000}
                error={fieldError("max_gross_weight_lbs")}
              />
              <Field
                name="empty_weight_lbs"
                label="Empty weight (lbs)"
                type="number"
                min={1}
                max={200_000}
                error={fieldError("empty_weight_lbs")}
              />
              <Field
                name="cruise_speed_kt"
                label="Cruise speed (kt)"
                type="number"
                min={40}
                max={600}
                error={fieldError("cruise_speed_kt")}
              />
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              With max gross and empty weight, the useful load is worked out from them. The cruise
              speed fills in each leg&rsquo;s time on a new flight.
            </p>

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
