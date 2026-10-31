"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";

import { createHousingBookingAction } from "@/app/(app)/housing/actions";
import { buttonOutline, buttonSolid } from "@/components/ff/controls";
import { Notice } from "@/components/ff/notice";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BOOKING_PURPOSE_LABELS, BOOKING_PURPOSES } from "@/lib/api/housing";

export interface StayRoom {
  id: string;
  /** "Bethel Crew House · 01 (single, holds 1)". */
  label: string;
}

export interface StayPerson {
  id: string;
  name: string;
}

/** The next day of an ISO date. */
function nextDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Book a stay (#158). The client, 10/29: "Need: (1) 'Book a stay':
 * employee, house, room, check-in/out, purpose (crew rest, training,
 * rotation, ...), from the house page and by clicking an empty run of
 * nights on the calendar." The service refuses a night past the room's
 * capacity and says who is there; that message is shown as it comes.
 */
export function BookStayDialog({
  rooms,
  people,
  roomId,
  checkIn,
  trigger,
  triggerClassName,
  triggerLabel,
}: {
  rooms: StayRoom[];
  people: StayPerson[];
  /** Preselected, from the calendar's night. */
  roomId?: string;
  checkIn?: string;
  /** What opens it: a button by default. */
  trigger?: "button" | "cell";
  triggerClassName?: string;
  triggerLabel?: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    start(async () => {
      const result = await createHousingBookingAction({ ok: false, error: "" }, form);
      if (result.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error ?? "The stay couldn’t be booked.");
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={triggerClassName ?? (trigger === "cell" ? undefined : buttonSolid)}
        aria-label={trigger === "cell" ? `Book a stay from ${checkIn}` : undefined}
      >
        {triggerLabel ?? "Book a stay"}
      </button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Book a stay</DialogTitle>
            <DialogDescription>
              Who, where, and the nights: check-out is the morning they leave.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="field-label">Employee</span>
              <select name="employee_user_id" required className="ff-input" defaultValue="">
                <option value="" disabled>
                  — Choose —
                </option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className="field-label">Room</span>
              <select name="room_id" required className="ff-input" defaultValue={roomId ?? ""}>
                <option value="" disabled>
                  — Choose —
                </option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="field-label">Check-in</span>
              <input name="check_in" type="date" required defaultValue={checkIn ?? ""} className="ff-input" />
            </label>
            <label>
              <span className="field-label">Check-out</span>
              <input
                name="check_out"
                type="date"
                defaultValue={checkIn ? nextDay(checkIn) : ""}
                className="ff-input"
              />
            </label>
            <label className="sm:col-span-2">
              <span className="field-label">Purpose</span>
              <select name="purpose" className="ff-input" defaultValue="crew_rest">
                {BOOKING_PURPOSES.map((p) => (
                  <option key={p} value={p}>
                    {BOOKING_PURPOSE_LABELS[p]}
                  </option>
                ))}
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className="field-label">Notes</span>
              <textarea name="notes" rows={2} maxLength={2000} className="ff-input" />
            </label>
            {error ? (
              <Notice tone="red" className="sm:col-span-2">
                {error}
              </Notice>
            ) : null}
            <DialogFooter className="sm:col-span-2">
              <button type="button" className={buttonOutline} onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </button>
              <button type="submit" className={buttonSolid} disabled={pending}>
                {pending ? "Booking…" : "Book"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
