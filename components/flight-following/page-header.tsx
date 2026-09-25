import Link from "next/link";

import { Button } from "@/components/ui/button";

import { AutoClock } from "./auto-clock";

/**
 * Page header for /flight-following — title + subtitle + the two
 * top-right action buttons (History, + Open Flight).
 *
 * The subtitle hosts the live Zulu clock (client component) which
 * dispatchers reference constantly. Auto-refresh cadence text is
 * static — the actual refresh is driven by the per-display
 * components (FleetMap polls every 30 s; the upcoming list view
 * will poll every 60 s to match the legacy board).
 *
 * Schedule, History and "+ Open Flight" are real links —
 * /schedule, /flight-following/history and /flight-following/new all
 * have pages. This said they pointed at stub routes "until M2-G-14"
 * for a long time after those shipped.
 */
export function PageHeader() {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Flight Following
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live ops board · auto-refreshes every 60 s ·{" "}
          <AutoClock />
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="secondary" size="sm">
          <Link href="/schedule" title="Published schedule + printable manifest">
            Schedule
          </Link>
        </Button>
        <Button asChild variant="secondary" size="sm">
          <Link href="/flight-following/history">History</Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/flight-following/new">+ Open Flight</Link>
        </Button>
      </div>
    </div>
  );
}
