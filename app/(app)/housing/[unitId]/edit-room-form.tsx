"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  ROOM_STATUSES,
  ROOM_STATUS_LABELS,
  ROOM_TYPES,
  ROOM_TYPE_LABELS,
  type HousingRoom,
  type RoomStatus,
  type RoomType,
} from "@/lib/api/housing";

import { updateHousingRoomAction } from "../actions";

/**
 * Edit Room drawer, one per row on /housing/[unitId].
 *
 * Legacy has room edit plus a separate status setter
 * (`POST /housing/rooms/{id}/status`); ours is one PATCH, so status is
 * just another field here.
 *
 * WHY THIS MATTERS BEYOND TYPOS
 *
 * `cost_per_night` is the input to the housing cost report. Without an
 * edit form the only way to price a room was to get it right when the
 * room was created, and a room with no rate contributes nothing to the
 * cost total — the report says so, but it could not be fixed from the
 * UI.
 *
 * Not role-gated in the UI, matching the drawers beside it; the
 * service gates on exec-admin claims and a refusal shows below.
 */
export function EditRoomDrawer({
  unitId,
  room,
}: {
  unitId: string;
  room: HousingRoom;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(form: HTMLFormElement) {
    const fd = new FormData(form);
    const text = (k: string) => String(fd.get(k) ?? "").trim();
    setError(null);
    start(async () => {
      const result = await updateHousingRoomAction(unitId, room.id, {
        room_number: text("room_number"),
        room_type: text("room_type") as RoomType,
        capacity: Number(text("capacity")),
        status: text("status") as RoomStatus,
        amenities: text("amenities") || null,
        // "" is passed through deliberately — the action maps it to
        // null, which is "no nightly rate" rather than a rate of zero.
        cost_per_night: text("cost_per_night"),
        has_wifi: fd.get("has_wifi") === "on",
        has_kitchen: fd.get("has_kitchen") === "on",
        has_private_bath: fd.get("has_private_bath") === "on",
        has_laundry: fd.get("has_laundry") === "on",
        notes: text("notes") || null,
      });
      if (!result.ok) {
        setError(result.error ?? "Couldn't save the room.");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  const cost =
    room.cost_per_night === null || room.cost_per_night === undefined
      ? ""
      : String(room.cost_per_night);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="text-[0.7rem] font-semibold text-primary hover:underline"
      >
        Edit
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Edit room ${room.room_number}`}
          className="fixed inset-0 z-40 flex items-start justify-end bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="h-full w-full max-w-md overflow-y-auto border-l border-border bg-card p-5 shadow-xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 className="text-sm font-bold">
                Edit Room {room.room_number}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
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
              <div className="grid grid-cols-2 gap-3">
                <Field label="Room number" required>
                  <input
                    name="room_number"
                    defaultValue={room.room_number}
                    required
                    maxLength={50}
                    className={INPUT}
                  />
                </Field>
                <Field label="Capacity" required>
                  <input
                    name="capacity"
                    type="number"
                    min={1}
                    defaultValue={room.capacity}
                    required
                    className={INPUT}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type">
                  <select
                    name="room_type"
                    defaultValue={room.room_type}
                    className={INPUT}
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
                    defaultValue={room.status}
                    className={INPUT}
                  >
                    {ROOM_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {ROOM_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Cost per night (USD)">
                <input
                  name="cost_per_night"
                  type="number"
                  step="0.01"
                  min={0}
                  defaultValue={cost}
                  placeholder="No rate set"
                  className={INPUT}
                />
                <span className="mt-1 block text-[0.65rem] text-muted-foreground">
                  Leave blank for no rate. A room with no rate is left
                  out of the cost report rather than counted as free.
                </span>
              </Field>

              <fieldset>
                <legend className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Amenities
                </legend>
                <div className="flex flex-wrap gap-3">
                  <Check name="has_wifi" label="Wi-Fi" checked={room.has_wifi} />
                  <Check
                    name="has_kitchen"
                    label="Kitchen"
                    checked={room.has_kitchen}
                  />
                  <Check
                    name="has_private_bath"
                    label="Private bath"
                    checked={room.has_private_bath}
                  />
                  <Check
                    name="has_laundry"
                    label="Laundry"
                    checked={room.has_laundry}
                  />
                </div>
              </fieldset>

              <Field label="Amenities note">
                <input
                  name="amenities"
                  defaultValue={room.amenities ?? ""}
                  className={INPUT}
                />
              </Field>
              <Field label="Notes">
                <textarea
                  name="notes"
                  rows={2}
                  defaultValue={room.notes ?? ""}
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
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-accent"
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

function Check({
  name,
  label,
  checked,
}: {
  name: string;
  label: string;
  checked: boolean;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <input
        name={name}
        type="checkbox"
        defaultChecked={checked}
        className="h-3.5 w-3.5 rounded border-border"
      />
      {label}
    </label>
  );
}
