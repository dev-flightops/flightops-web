"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { CSSProperties, DragEvent, MouseEvent, ReactNode } from "react";

/** What a dragged block carries (#150). */
export const DRAG_TYPE = "application/x-fleet-board-booking";

export interface DraggedBooking {
  bookingId: string;
  flightId: string | null;
  flightNumber: string | null;
  /** Bookings on its flight, which move with it. */
  onFlight: number;
  fromAircraftId: string | null;
}

/** Client wrapper that turns a Fleet Board block into a drawer opener.
 *  Instead of navigating to /reservations/bookings/{id}, we push ?booking={id}
 *  onto the current fleet-board URL so the server component can render the
 *  drawer over the board without losing view/date state. */
export function BookingClickable({
  bookingId,
  className,
  style,
  title,
  drag,
  children,
}: {
  bookingId: string;
  className?: string;
  style?: CSSProperties;
  title?: string;
  /** Drag it onto another aircraft's row (#150); none for a cancelled one. */
  drag?: DraggedBooking;
  children: ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const next = new URLSearchParams(searchParams.toString());
    next.set("booking", bookingId);
    router.push(`?${next.toString()}`, { scroll: false });
  };

  const onDragStart = (e: DragEvent<HTMLButtonElement>) => {
    if (!drag) return;
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(drag));
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <button
      type="button"
      onClick={onClick}
      draggable={Boolean(drag)}
      onDragStart={onDragStart}
      className={className}
      style={style}
      title={title}
    >
      {children}
    </button>
  );
}
