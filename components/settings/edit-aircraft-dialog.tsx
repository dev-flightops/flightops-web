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
        className="rounded-md border border-border bg-card px-2.5 py-1 text-[0.7rem] font-semibold text-foreground hover:bg-muted/40"
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
                className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
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
                label="Seats"
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
                className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
              >
                Special notes
              </label>
              <textarea
                id="special_notes"
                name="special_notes"
                rows={2}
                maxLength={200}
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
