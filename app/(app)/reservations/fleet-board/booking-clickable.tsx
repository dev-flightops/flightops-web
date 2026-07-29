"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { CSSProperties, MouseEvent, ReactNode } from "react";

/** Client wrapper that turns a Fleet Board block into a drawer opener.
 *  Instead of navigating to /reservations/bookings/{id}, we push ?booking={id}
 *  onto the current fleet-board URL so the server component can render the
 *  drawer over the board without losing view/date state. */
export function BookingClickable({
  bookingId,
  className,
  style,
  title,
  children,
}: {
  bookingId: string;
  className?: string;
  style?: CSSProperties;
  title?: string;
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

  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      style={style}
      title={title}
    >
      {children}
    </button>
  );
}
