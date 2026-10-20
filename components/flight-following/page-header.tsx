import Link from "next/link";

import { buttonOutline, buttonSolid } from "@/components/ff/controls";
import { PageHeader as Header } from "@/components/ff/page-header";

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
    <Header
      title="Flight Following"
      description={
        <>
          Live ops board · auto-refreshes every 60 s ·{" "}
          <span className="font-mono tabular-nums text-foreground">
            <AutoClock />
          </span>
        </>
      }
      actions={
        <>
          <Link href="/schedule" title="Published schedule + printable manifest" className={buttonOutline}>
            Schedule
          </Link>
          <Link href="/flight-following/history" className={buttonOutline}>
            History
          </Link>
          <Link href="/flight-following/new" className={buttonSolid}>
            Open Flight
          </Link>
        </>
      }
    />
  );
}
