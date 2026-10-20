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

import {
  addVillageAirportAction,
  type VillageActionState,
} from "@/app/(app)/village-wx/actions";

export function AddAirportDialog() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<
    VillageActionState,
    FormData
  >(addVillageAirportAction, { status: "idle" });

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
        className="btn-caps inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-foreground hover:bg-accent text-[0.72rem]"
      >
        + Add Airport
      </button>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Add a village airport</DialogTitle>
            <DialogDescription>
              An ICAO the operator flies into that AWC doesn&apos;t publish
              METAR for. Region is free-text — group by what makes sense
              for your op (e.g. &quot;YK Delta&quot;, &quot;Bristol Bay&quot;).
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

            <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
              <Field
                name="icao"
                label="ICAO"
                placeholder="PABE"
                required
                autoCapitalize="characters"
                spellCheck={false}
                error={fieldError("icao")}
              />
              <Field
                name="name"
                label="Name"
                placeholder="Bethel"
                required
                error={fieldError("name")}
              />
            </div>

            <Field
              name="region"
              label="Region"
              placeholder="YK Delta"
              error={fieldError("region")}
            />

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
                rows={2}
                placeholder="Gravel strip, no fuel, glider tow ops on weekends"
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
                className="btn-caps inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-white hover:bg-brand-dark disabled:opacity-60 text-[0.72rem]"
              >
                {pending && <Spinner size="xs" />}
                {pending ? "Adding…" : "Add airport"}
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
