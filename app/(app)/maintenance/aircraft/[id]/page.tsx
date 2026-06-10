import Link from "next/link";
import { notFound } from "next/navigation";

import { MelTable } from "@/components/maintenance/mel-table";
import { SquawksTable } from "@/components/maintenance/squawks-table";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";
import {
  getAirworthiness,
  listMelItems,
  listSquawks,
} from "@/lib/api/maintenance";
import type {
  AirworthinessResponse,
  MelItemResponse,
  SquawkResponse,
} from "@/lib/api/types";

/**
 * /maintenance/aircraft/[id] — per-aircraft maintenance detail (M2-G-20).
 *
 * Three parallel fetches:
 *   - getAirworthiness(id)  → verdict + grouped issue lists
 *   - listMelItems({aircraftId: id, status: "open"})
 *   - listSquawks({aircraftId: id, status: "open" | "in_progress"})
 *
 * Page is read-only at this scope. Close MEL / Resolve squawk actions
 * live on the dispatch maintenance panel (M2-G-17); M2-G-20b can pull
 * those dialogs into this page once they're decoupled from the
 * dispatch context.
 *
 * `status` doesn't accept multi-value yet on /maintenance/squawks, so
 * we issue two parallel calls and merge for open + in_progress —
 * cheap (1 query each) and avoids a backend change for this story.
 */
export default async function AircraftDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let verdict: AirworthinessResponse | null = null;
  let mels: MelItemResponse[] = [];
  let openSquawks: SquawkResponse[] = [];
  let inProgressSquawks: SquawkResponse[] = [];
  let loadError: string | null = null;

  try {
    const [verdictResult, melsResult, openResult, inProgressResult] =
      await Promise.all([
        getAirworthiness(id),
        listMelItems({ aircraftId: id, status: "open" }),
        listSquawks({ aircraftId: id, status: "open" }),
        listSquawks({ aircraftId: id, status: "in_progress" }),
      ]);
    verdict = verdictResult;
    mels = melsResult.items;
    openSquawks = openResult.items;
    inProgressSquawks = inProgressResult.items;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Maintenance feed unavailable. Try refreshing in a moment.";
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <BackLink />
        <div
          role="alert"
          className="rounded-md border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      </div>
    );
  }
  if (verdict === null) notFound();  // unreachable in the happy path

  const squawks = [...openSquawks, ...inProgressSquawks].sort(
    (a, b) => Date.parse(b.reported_at) - Date.parse(a.reported_at),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <BackLink />
      <AircraftHeader verdict={verdict} />

      <section className="mt-8">
        <SectionHeader title="Open MEL items" count={mels.length} />
        <MelTable items={mels} />
      </section>

      <section className="mt-8">
        <SectionHeader title="Open squawks" count={squawks.length} />
        <SquawksTable items={squawks} />
      </section>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/maintenance"
      className="mb-4 inline-block text-xs text-muted-foreground hover:text-foreground hover:underline"
    >
      ← Fleet
    </Link>
  );
}

function AircraftHeader({ verdict }: { verdict: AirworthinessResponse }) {
  const blockingCount = verdict.blocking_issues.length;
  const advisoryCount = verdict.advisory_issues.length;
  const isAirworthy = verdict.is_airworthy;
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
      <div>
        <h1 className="font-mono text-2xl font-bold tracking-tight text-foreground">
          {verdict.aircraft.tail_number}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {verdict.aircraft.model}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[0.65rem] uppercase tracking-[0.08em]">
        <VerdictPill isAirworthy={isAirworthy} blockingCount={blockingCount} />
        <Stat
          label="Blocking"
          value={blockingCount}
          tone={blockingCount > 0 ? "red" : "muted"}
        />
        <Stat
          label="Advisory"
          value={advisoryCount}
          tone={advisoryCount > 0 ? "yellow" : "muted"}
        />
      </div>
    </header>
  );
}

function VerdictPill({
  isAirworthy,
  blockingCount,
}: {
  isAirworthy: boolean;
  blockingCount: number;
}) {
  const grounded = !isAirworthy || blockingCount > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.08em]",
        grounded
          ? "bg-status-red/15 text-status-red"
          : "bg-status-green/15 text-status-green",
      )}
    >
      {grounded ? "Grounded" : "Airworthy"}
    </span>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "red" | "yellow" | "muted";
}) {
  const toneClass = {
    red: "bg-status-red/15 text-status-red",
    yellow: "bg-status-yellow/15 text-status-yellow",
    muted: "bg-muted/30 text-muted-foreground",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-1 font-semibold",
        toneClass,
      )}
    >
      <span className="font-mono text-sm font-bold tabular-nums">{value}</span>
      <span>{label}</span>
    </span>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <h2 className="mb-3 flex items-baseline gap-2 text-sm font-semibold text-foreground">
      {title}
      <span className="font-mono text-xs font-normal tabular-nums text-muted-foreground">
        ({count})
      </span>
    </h2>
  );
}
