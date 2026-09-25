"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { HousingUnit } from "@/lib/api/housing";

import { updateHousingUnitAction } from "../actions";

/**
 * Edit House drawer for /housing/[unitId].
 *
 * Legacy has this as an inline panel on the unit detail page, plus
 * click-to-edit on the title. We had no way to change a house at all
 * once it was created — a typo in the name or a new contact number
 * meant the row stayed wrong — even though the service has always
 * accepted PATCH /housing/units/{id}.
 *
 * Deliberately not inline-editable like legacy: inline edit there
 * writes one field per click through `/housing/api/inline-edit` and
 * records it in an edit log we do not have. A drawer that saves the
 * whole form is one request and one revalidate, and does not imply an
 * audit trail that isn't there.
 *
 * NOT ROLE-GATED IN THE UI, matching the Add Room drawer beside it:
 * the service gates housing writes on exec-admin claims, and a refusal
 * shows up as the message below rather than a hidden control.
 *
 * Legacy also uploads a house photo here. We have no photo_url column,
 * so that field is absent rather than present-and-inert.
 */
export function EditUnitDrawer({ unit }: { unit: HousingUnit }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Blank optional fields are sent as null, which clears them. That is
  // the point of an edit form: emptying the contact phone has to be
  // able to remove it, not be silently ignored.
  function onSubmit(form: HTMLFormElement) {
    const fd = new FormData(form);
    const text = (k: string) => String(fd.get(k) ?? "").trim();
    const orNull = (k: string) => text(k) || null;
    setError(null);
    start(async () => {
      const result = await updateHousingUnitAction(unit.id, {
        name: text("name"),
        station: text("station"),
        address: orNull("address"),
        contact_person: orNull("contact_person"),
        contact_phone: orNull("contact_phone"),
        color_accent: orNull("color_accent"),
        notes: orNull("notes"),
      });
      if (!result.ok) {
        setError(result.error ?? "Couldn't save the house.");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-muted/20"
      >
        Edit House
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit house"
          className="fixed inset-0 z-40 flex items-start justify-end bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="h-full w-full max-w-md overflow-y-auto border-l border-border bg-card p-5 shadow-xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold">Edit House</h2>
                <p className="mt-0.5 text-[0.7rem] text-muted-foreground">
                  Clearing an optional field removes it.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSubmit(e.currentTarget);
              }}
              className="space-y-3"
            >
              <Field label="House name" required>
                <input
                  name="name"
                  defaultValue={unit.name}
                  required
                  maxLength={200}
                  className={INPUT}
                />
              </Field>
              <Field label="Station" required>
                <input
                  name="station"
                  defaultValue={unit.station}
                  required
                  maxLength={80}
                  className={INPUT}
                />
              </Field>
              <Field label="Address">
                <input
                  name="address"
                  defaultValue={unit.address ?? ""}
                  className={INPUT}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Contact person">
                  <input
                    name="contact_person"
                    defaultValue={unit.contact_person ?? ""}
                    maxLength={200}
                    className={INPUT}
                  />
                </Field>
                <Field label="Contact phone">
                  <input
                    name="contact_phone"
                    defaultValue={unit.contact_phone ?? ""}
                    maxLength={50}
                    className={INPUT}
                  />
                </Field>
              </div>
              <Field label="Colour accent">
                {/* Used as the left stripe on the calendar board, which
                    is why it is worth setting. */}
                <input
                  name="color_accent"
                  type="color"
                  defaultValue={unit.color_accent ?? "#3b82f6"}
                  className="h-9 w-full rounded-md border border-border bg-background p-1"
                />
              </Field>
              <Field label="Notes">
                <textarea
                  name="notes"
                  rows={3}
                  defaultValue={unit.notes ?? ""}
                  className={INPUT}
                />
              </Field>

              {error && (
                <p role="alert" className="text-xs text-status-red">
                  {error}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-muted/20"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

const INPUT =
  "w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none";

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
        {required && <span className="text-status-red"> *</span>}
      </span>
      {children}
    </label>
  );
}
