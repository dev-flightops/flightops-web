"use client";

import { useActionState, useState } from "react";

import {
  ROOM_STATUSES,
  ROOM_STATUS_LABELS,
  ROOM_TYPE_LABELS,
  ROOM_TYPES,
} from "@/lib/api/housing";

import type { ActionResult } from "../actions";
import { addHousingRoomAction } from "../actions";

/**
 * Add-room drawer for /housing/[unitId]. Server action revalidates
 * the unit page so the new room shows up without a manual refresh.
 */
export function AddRoomDrawer({ unitId }: { unitId: string }) {
  const [open, setOpen] = useState(false);
  const action = addHousingRoomAction.bind(null, unitId);
  const [state, formAction, pending] = useActionState<
    ActionResult<{ id: string }>,
    FormData
  >(action, { ok: false });

  // Close when the create succeeds; the parent page revalidates.
  if (state.ok && state.data && open) setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-caps rounded-md bg-primary px-3 py-1.5 text-white hover:bg-brand-dark text-[0.72rem]"
      >
        + Add Room
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add room"
          className="fixed inset-0 z-40 flex items-start justify-end bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="h-full w-full max-w-md overflow-y-auto border-l border-border bg-card p-5">
            <header className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">Add Room</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  A room number + type + capacity is the minimum. Amenities +
                  cost are optional.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded p-1 text-muted-foreground hover:bg-accent"
              >
                ✕
              </button>
            </header>

            <form action={formAction} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Room number" required>
                  <input
                    name="room_number"
                    type="text"
                    required
                    placeholder="101"
                    className="ff-input px-3 py-1.5 text-xs"
                  />
                </Field>
                <Field label="Capacity">
                  <input
                    name="capacity"
                    type="number"
                    min={1}
                    step={1}
                    defaultValue={1}
                    className="ff-input px-3 py-1.5 text-xs"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Type">
                  <select
                    name="room_type"
                    defaultValue="single"
                    className="ff-input px-3 py-1.5 text-xs"
                  >
                    {ROOM_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {ROOM_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Status">
                  <select
                    name="status"
                    defaultValue="available"
                    className="ff-input px-3 py-1.5 text-xs"
                  >
                    {ROOM_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {ROOM_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Cost per night (USD, optional)">
                <input
                  name="cost_per_night"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  className="ff-input px-3 py-1.5 text-xs"
                />
              </Field>

              <fieldset className="rounded-md border border-border p-3">
                <legend className="px-1 eyebrow">
                  Amenities
                </legend>
                <div className="grid grid-cols-2 gap-1.5">
                  <Checkbox name="has_wifi" label="Wi-Fi" />
                  <Checkbox name="has_kitchen" label="Kitchen" />
                  <Checkbox name="has_private_bath" label="Private bath" />
                  <Checkbox name="has_laundry" label="Laundry" />
                </div>
              </fieldset>

              <Field label="Amenities note (optional)">
                <input
                  name="amenities"
                  type="text"
                  placeholder="e.g. king bed, workspace"
                  className="ff-input px-3 py-1.5 text-xs"
                />
              </Field>

              <Field label="Notes (optional)">
                <textarea
                  name="notes"
                  rows={3}
                  placeholder="Access, quirks, contact info…"
                  className="ff-input px-3 py-1.5 text-xs"
                />
              </Field>

              {state.error && (
                <p role="alert" className="text-xs text-status-red">
                  {state.error}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn-caps rounded-md border border-input px-3 py-1.5 text-foreground hover:bg-accent text-[0.72rem]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="btn-caps rounded-md bg-primary px-3 py-1.5 text-white hover:bg-brand-dark disabled:opacity-60 text-[0.72rem]"
                >
                  {pending ? "Adding…" : "Add room"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="field-label">
        {label}
        {required && <span className="ml-1 text-status-red">*</span>}
      </span>
      {children}
    </label>
  );
}

function Checkbox({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <input type="checkbox" name={name} className="accent-primary" />
      <span>{label}</span>
    </label>
  );
}
