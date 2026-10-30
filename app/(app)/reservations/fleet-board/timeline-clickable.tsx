"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type DragEvent, type MouseEvent, type ReactNode, useState, useTransition } from "react";

import { buttonOutline, buttonSolid } from "@/components/ff/controls";

import { moveOnBoardAction } from "./actions";
import { DRAG_TYPE, type DraggedBooking } from "./booking-clickable";

/** Wraps a TimelineTrack so clicking on empty space (not on a
 *  BookingBlock) opens the "new booking" drawer pre-filled with the
 *  clicked aircraft + the hour the cursor was over.
 *
 *  We compute the hour from the click's X offset within the 24h track:
 *    hour = round((x / width) * 24)
 *  and push ?new=1&aircraft_id={id}&t={HH:MM} onto the current URL.
 *  The page's server component reads those params and renders the
 *  new-booking drawer. Clicks that originated on a BookingBlock button
 *  are ignored — those still open the detail drawer via BookingClickable.
 */
export function TimelineClickable({
  aircraftId,
  tailNumber = null,
  isoDay,
  children,
}: {
  aircraftId: string | null;
  /** The row's aircraft, named when a block is dropped on it (#150). */
  tailNumber?: string | null;
  isoDay: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // A block dropped on this aircraft's row, waiting for the yes (#150).
  const [dropped, setDropped] = useState<DraggedBooking | null>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moving, startMoving] = useTransition();

  const accepts = (e: DragEvent<HTMLDivElement>) =>
    aircraftId !== null && e.dataTransfer.types.includes(DRAG_TYPE);
  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!accepts(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOver(true);
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    setOver(false);
    if (!accepts(e)) return;
    e.preventDefault();
    let moved: DraggedBooking;
    try {
      moved = JSON.parse(e.dataTransfer.getData(DRAG_TYPE)) as DraggedBooking;
    } catch {
      return;
    }
    if (moved.fromAircraftId === aircraftId) return;
    setError(null);
    setDropped(moved);
  };
  const confirm = () => {
    if (!dropped || !aircraftId) return;
    startMoving(async () => {
      const result = await moveOnBoardAction({
        bookingId: dropped.bookingId,
        flightId: dropped.flightId,
        flightNumber: dropped.flightNumber,
        toAircraftId: aircraftId,
      });
      if (result.ok) {
        setDropped(null);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    // Ignore clicks that bubbled up from a booking block button —
    // BookingClickable calls preventDefault but not stopPropagation.
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const frac = Math.max(0, Math.min(1, x / rect.width));
    const hour = Math.round(frac * 24);
    // Clamp: 24 rounds down to 23:00 (still-same-day).
    const hh = String(Math.min(23, hour)).padStart(2, "0");

    const next = new URLSearchParams(searchParams.toString());
    next.set("new", "1");
    next.set("t", `${hh}:00`);
    if (aircraftId) {
      next.set("aircraft_id", aircraftId);
    } else {
      next.delete("aircraft_id");
    }
    // Preserve the day the user is viewing.
    if (!next.has("d")) next.set("d", isoDay);
    router.push(`?${next.toString()}`, { scroll: false });
  };

  const tail = tailNumber ?? "this aircraft";
  const question = dropped
    ? dropped.flightId
      ? `Move ${dropped.flightNumber ?? "the flight"} (${dropped.onFlight} booking${dropped.onFlight === 1 ? "" : "s"}) to ${tail}?`
      : `Put this booking on ${tail}?`
    : "";

  return (
    <>
      <div
        onClick={onClick}
        onDragOver={onDragOver}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={`relative h-14 cursor-crosshair${over ? " bg-primary/10 outline outline-1 outline-primary/40" : ""}`}
      >
        {children}
      </div>
      {dropped ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Move to another aircraft"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md border border-border bg-card p-5">
            <p className="page-title text-lg">{question}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {dropped.flightId
                ? "The whole flight moves: every booking on it goes with it. A released flight has to be pulled back first."
                : "The booking isn't on a flight yet, so only its aircraft changes."}
            </p>
            {error ? (
              <p role="alert" className="notice notice-red mt-3 text-sm">
                {error}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={buttonOutline} onClick={() => setDropped(null)} disabled={moving}>
                Cancel
              </button>
              <button type="button" className={buttonSolid} onClick={confirm} disabled={moving}>
                {moving ? "Moving…" : "Move"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
