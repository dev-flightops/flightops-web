"use client";

import { useActionState, useEffect, useState } from "react";

import {
  updateAircraftAction,
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
import type { AircraftListItem } from "@/lib/api/types";

export function EditAircraftDialog({ aircraft }: { aircraft: AircraftListItem }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FleetActionState, FormData>(
    updateAircraftAction,
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
        className="btn-caps rounded-md border border-input px-2.5 py-1 text-foreground hover:bg-accent text-[0.68rem]"
      >
        Edit
      </button>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Edit {aircraft.tail_number}</DialogTitle>
            <DialogDescription>
              Tail number can&apos;t be changed here — re-registration is a
              compliance event with its own audit trail.
            </DialogDescription>
          </DialogHeader>

          <form action={action} className="space-y-4">
            <input type="hidden" name="aircraft_id" value={aircraft.id} />
            {state.status === "api-error" && (
              <div
                role="alert"
                className="notice notice-red"
              >
                {state.message}
              </div>
            )}

            <Field
              name="model"
              label="Model"
              defaultValue={aircraft.model ?? ""}
              error={fieldError("model")}
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                name="seats"
                label="Passenger seats"
                type="number"
                min={1}
                max={999}
                defaultValue={aircraft.seats}
                error={fieldError("seats")}
              />
              <Field
                name="max_payload_lbs"
                label="Useful load (lbs)"
                type="number"
                min={0}
                max={200_000}
                defaultValue={aircraft.max_payload_lbs ?? ""}
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
                defaultValue={aircraft.max_gross_weight_lbs ?? ""}
                error={fieldError("max_gross_weight_lbs")}
              />
              <Field
                name="empty_weight_lbs"
                label="Empty weight (lbs)"
                type="number"
                min={1}
                max={200_000}
                defaultValue={aircraft.empty_weight_lbs ?? ""}
                error={fieldError("empty_weight_lbs")}
              />
              <Field
                name="cruise_speed_kt"
                label="Cruise speed (kt)"
                type="number"
                min={40}
                max={600}
                defaultValue={aircraft.cruise_speed_kt ?? ""}
                error={fieldError("cruise_speed_kt")}
              />
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              With max gross and empty weight, the useful load is worked out from them. The cruise
              speed fills in each leg&rsquo;s time on a new flight.
            </p>

            {/* HALT-2 — airframe identity, grouped as its own row because
                these read together on the fleet card. */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                name="year"
                label="Year"
                type="number"
                min={1903}
                max={2100}
                placeholder="2019"
                defaultValue={aircraft.year ?? ""}
                error={fieldError("year")}
              />
              <Field
                name="make"
                label="Make"
                placeholder="Cessna"
                defaultValue={aircraft.make ?? ""}
                error={fieldError("make")}
              />
              <Field
                name="serial_number"
                label="Serial number"
                placeholder="208B1234"
                autoCapitalize="characters"
                spellCheck={false}
                defaultValue={aircraft.serial_number ?? ""}
                error={fieldError("serial_number")}
              />
            </div>

            <Field
              name="airframe_type"
              label="Airframe slug"
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
                {pending ? "Saving…" : "Save changes"}
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
