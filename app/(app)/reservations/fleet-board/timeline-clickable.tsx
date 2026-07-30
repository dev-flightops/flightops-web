"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

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
  isoDay,
  children,
}: {
  aircraftId: string | null;
  isoDay: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

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

  return (
    <div onClick={onClick} className="relative h-14 cursor-crosshair">
      {children}
    </div>
  );
}
