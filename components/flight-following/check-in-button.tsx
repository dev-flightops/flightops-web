"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Spinner } from "@/components/ui/spinner";

import { checkInFlightAction, type CheckInEvent } from "./check-in-action";

/**
 * Inline check-in control rendered in the flight board's actions column
 * (M2-G-11b). State machine:
 *
 *   status=released AND no actual_departure_at  → "Mark Departed"
 *   status=released AND actual_departure_at set → "Mark Arrived"
 *   any other state                             → button hidden
 *
 * The Mark-Arrived action also flips the row to `completed` server-side
 * (M2-M-19 returns the updated FlightDetail); the page picks that up
 * via `router.refresh()` after the action resolves.
 *
 * Uses confirm() so a stray click doesn't fire-and-flip — same
 * defensive pattern the EOD cancel-stale button uses.
 */
export function CheckInButton({
  flightId,
  event,
}: {
  flightId: string;
  event: CheckInEvent;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const label = event === "depart" ? "Mark Departed" : "Mark Arrived";
  const confirmCopy =
    event === "depart"
      ? "Record actual departure now?"
      : "Record actual arrival now? This also closes the flight as completed.";

  const onClick = () => {
    if (!window.confirm(confirmCopy)) return;
    startTransition(async () => {
      const result = await checkInFlightAction(flightId, event);
      if (!result.ok) {
        window.alert(result.error);
      }
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="mr-4 inline-flex items-center gap-1 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-status-green underline-offset-4 hover:underline disabled:opacity-50"
    >
      {pending && <Spinner size="xs" />}
      {pending ? "Saving…" : label}
    </button>
  );
}
