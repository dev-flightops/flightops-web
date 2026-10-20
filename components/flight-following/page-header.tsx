import Link from "next/link";

import { buttonOutline, buttonSolid } from "@/components/ff/controls";

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
    // ForeFlight's page head (#78): display title, a quiet line under it,
    // actions as outlined and solid UPPERCASE buttons, a rule beneath.
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div>
        <h1 className="page-title">Flight Following</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Live ops board · auto-refreshes every 60 s ·{" "}
          <span className="font-mono tabular-nums text-foreground">
            <AutoClock />
          </span>
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/schedule"
          title="Published schedule + printable manifest"
          className={buttonOutline}
        >
          Schedule
        </Link>
        <Link href="/flight-following/history" className={buttonOutline}>
          History
        </Link>
        <Link href="/flight-following/new" className={buttonSolid}>
          Open Flight
        </Link>
      </div>
    </div>
  );
}
