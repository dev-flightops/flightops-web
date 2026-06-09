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
 * "+ Open Flight" and "History" point at stub routes that ship in
 * M2-G-14. Until then they render a "Coming soon" placeholder rather
 * than a 404 — keeps the chrome usable end-to-end during M2.
 */
export function PageHeader() {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          Flight Following
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Live ops board · auto-refreshes every 60 s ·{" "}
          <AutoClock />
        </p>
      </div>
      <div className="flex gap-2">
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
