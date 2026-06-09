import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Stub — the real "+ Open Flight" form lands in M2-G-14 (legacy
 * `templates/flight_following/flight_form.html`). Quick-open variant
 * for ad-hoc flights that aren't on the dispatched schedule.
 *
 * Shipped now so the "+ Open Flight" button in the M2-G-10 chrome
 * doesn't 404.
 */
export default function FlightFollowingNewPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
        Open Flight
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Coming in M2-G-14. Quick-open form to start tracking a flight
        that isn&apos;t already on the dispatch schedule — pick the
        aircraft, set route + ETD, and the flight appears on the board
        with status Planned.
      </p>
      <Button asChild variant="secondary" size="sm" className="mt-6">
        <Link href="/flight-following">← Back to board</Link>
      </Button>
    </div>
  );
}
