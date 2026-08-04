"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";

import type { ActionResult } from "./actions";
import { createHousingUnitAction } from "./actions";

/**
 * Slide-over drawer for creating a new housing unit. Opens from the
 * "+ New House" button on /housing. On success, closes and navigates
 * to the new unit's detail page.
 */
export function NewUnitDrawer() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<
    ActionResult<{ id: string }>,
    FormData
  >(createHousingUnitAction, { ok: false });
  const router = useRouter();

  // After a successful create, route to the new unit.
  if (state.ok && state.data && open) {
    setOpen(false);
    router.push(`/housing/${state.data.id}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-status-blue px-3 py-2 text-xs font-semibold text-white hover:brightness-110"
      >
        + New House
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="New housing unit"
          className="fixed inset-0 z-40 flex items-start justify-end bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="h-full w-full max-w-md overflow-y-auto border-l border-border bg-card p-5 shadow-xl">
            <header className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">New Housing Unit</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Add a building or dorm at a station. You can add rooms after
                  creating.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded p-1 text-muted-foreground hover:bg-muted/20"
              >
                ✕
              </button>
            </header>

            <form action={action} className="space-y-3">
              <TextField
                name="name"
                label="Name"
                placeholder="Emmonak Crew House"
                required
                hint="Displayed on the units list and calendar."
              />
              <TextField
                name="station"
                label="Station (ICAO)"
                placeholder="PAEM"
                required
                autoComplete="off"
              />
              <TextField
                name="address"
                label="Address"
                placeholder="123 Main St, Emmonak AK 99581"
              />
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  name="contact_person"
                  label="Contact person"
                  placeholder="Marie Anaruk"
                />
                <TextField
                  name="contact_phone"
                  label="Contact phone"
                  placeholder="907-555-0100"
                />
              </div>
              <ColorField name="color_accent" label="Color accent (optional)" />
              <TextAreaField
                name="notes"
                label="Notes (optional)"
                placeholder="Gate combo, WiFi password, dispatcher phone, etc."
              />

              {state.error && (
                <p role="alert" className="text-xs text-status-red">
                  {state.error}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-muted/20"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-status-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
                >
                  {pending ? "Creating…" : "Create unit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function TextField({
  name,
  label,
  placeholder,
  required,
  hint,
  autoComplete,
}: {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label
        htmlFor={`field-${name}`}
        className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
      >
        {label}
        {required && <span className="ml-1 text-status-red">*</span>}
      </label>
      <input
        id={`field-${name}`}
        name={name}
        type="text"
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-status-blue focus:outline-none"
      />
      {hint && (
        <p className="mt-1 text-[0.65rem] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

function TextAreaField({
  name,
  label,
  placeholder,
}: {
  name: string;
  label: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label
        htmlFor={`field-${name}`}
        className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
      >
        {label}
      </label>
      <textarea
        id={`field-${name}`}
        name={name}
        rows={3}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-status-blue focus:outline-none"
      />
    </div>
  );
}

function ColorField({ name, label }: { name: string; label: string }) {
  const [value, setValue] = useState("");
  return (
    <div>
      <label
        htmlFor={`field-${name}`}
        className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
      >
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={`field-${name}`}
          name={name}
          type="text"
          placeholder="#3b82f6"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-status-blue focus:outline-none"
        />
        <span
          aria-hidden
          className="h-7 w-7 flex-shrink-0 rounded-md border border-border"
          style={{
            backgroundColor: /^#[0-9a-fA-F]{6}$/.test(value)
              ? value
              : "transparent",
          }}
        />
      </div>
      <p className="mt-1 text-[0.65rem] text-muted-foreground">
        Optional hex for the calendar tag chip. Leave blank for default.
      </p>
    </div>
  );
}
