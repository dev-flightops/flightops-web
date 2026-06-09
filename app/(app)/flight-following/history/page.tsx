import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Stub — the real History page lands in M2-G-14 (paged list of
 * completed + cancelled flights with route + actuals + filter chips).
 *
 * Shipped now alongside the M2-G-10 page chrome so the "History"
 * button in the page header doesn't 404. Tests pin this so we
 * remember to replace the body rather than leave it as the final UX.
 */
export default function FlightFollowingHistoryPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
        Flight Following · History
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Coming in M2-G-14. Will list completed + cancelled flights with
        actual times, route, and PIC, filterable by date range and
        aircraft.
      </p>
      <Button asChild variant="secondary" size="sm" className="mt-6">
        <Link href="/flight-following">← Back to board</Link>
      </Button>
    </div>
  );
}
