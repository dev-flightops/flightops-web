"use client";

import { useEffect, useState } from "react";

import { flightWalkUpsAction } from "@/app/(app)/dispatch/[flightId]/actions";

/**
 * Who a cancelled flight leaves with no way back (#174).
 *
 * The client, 10/30, on a cancelled flight: "the pax that were on this flight
 * didn't show back up as needing a new flight." A booking goes back to
 * Awaiting a flight. A passenger added on the manifest itself has no booking,
 * so nothing would bring them back: whoever cancels is told who they are.
 */
export function WalkUpsNotice({ flightId }: { flightId: string }) {
  const [names, setNames] = useState<string[]>([]);

  useEffect(() => {
    let current = true;
    flightWalkUpsAction(flightId)
      .then((found) => {
        if (current) setNames(found);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [flightId]);

  if (names.length === 0) return null;
  return (
    <p role="status" className="notice notice-yellow text-sm">
      {`${names.join(", ")} ${names.length === 1 ? "has" : "have"} no booking, added on the manifest, so ${names.length === 1 ? "doesn't" : "don't"} go back to Awaiting a flight. Rebook them by hand.`}
    </p>
  );
}
