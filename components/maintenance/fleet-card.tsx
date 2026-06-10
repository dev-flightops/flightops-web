import Link from "next/link";

import { cn } from "@/lib/utils";
import type { FleetAircraftSummary } from "@/lib/api/types";

/**
 * One aircraft card on the Maintenance landing (M2-G-19).
 *
 * Status priority: grounding (blocking issues) > advisories > clean.
 * Inactive aircraft fade to 60% so retired tails are visible but
 * don't compete with the active fleet for attention.
 *
 * Counts come from the bulk /maintenance/airworthiness/fleet endpoint;
 * drilling into details navigates to /maintenance/aircraft/{id} (lands
 * in M2-G-20 — for now the link is provisional so the Details button
 * doesn't 404 we route to /dispatch?flight= ... no — keep going to the
 * planned detail route and the M2-G-20 page replaces the stub).
 */
export function FleetCard({ summary }: { summary: FleetAircraftSummary }) {
  const status = computeStatus(summary);

  return (
    <article
      className={cn(
        "rounded-lg border bg-card p-4",
        statusBorderClass(status),
        !summary.is_active && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <h2 className="font-mono text-base font-bold text-foreground">
              {summary.aircraft.tail_number}
            </h2>
            {!summary.is_active && (
              <span className="rounded bg-muted/40 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Inactive
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {summary.aircraft.model}
          </p>
        </div>
        <StatusPill status={status} />
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <Stat
          label="Blocking"
          value={summary.blocking_count}
          tone={summary.blocking_count > 0 ? "red" : "muted"}
        />
        <Stat
          label="Advisory"
          value={summary.advisory_count}
          tone={summary.advisory_count > 0 ? "yellow" : "muted"}
        />
        <Stat
          label="Open MEL"
          value={summary.open_mel_count}
          tone={summary.open_mel_count > 0 ? "yellow" : "muted"}
        />
        <Stat
          label="Open squawks"
          value={summary.open_squawk_count}
          tone={summary.open_squawk_count > 0 ? "yellow" : "muted"}
        />
        <div className="col-span-2" />
      </dl>

      <div className="mt-4 flex justify-end">
        <Link
          href={`/maintenance/aircraft/${summary.aircraft.id}`}
          className="text-[0.7rem] font-semibold text-status-blue hover:underline"
        >
          Details →
        </Link>
      </div>
    </article>
  );
}

type FleetStatus = "grounded" | "advisory" | "clean";

function computeStatus(summary: FleetAircraftSummary): FleetStatus {
  if (!summary.is_airworthy || summary.blocking_count > 0) return "grounded";
  if (summary.advisory_count > 0) return "advisory";
  return "clean";
}

function statusBorderClass(status: FleetStatus): string {
  switch (status) {
    case "grounded":
      return "border-status-red/40";
    case "advisory":
      return "border-status-yellow/40";
    case "clean":
      return "border-border";
  }
}

function StatusPill({ status }: { status: FleetStatus }) {
  const config: Record<FleetStatus, { label: string; className: string }> = {
    grounded: {
      label: "Grounded",
      className: "bg-status-red/15 text-status-red",
    },
    advisory: {
      label: "Advisory",
      className: "bg-status-yellow/15 text-status-yellow",
    },
    clean: {
      label: "Airworthy",
      className: "bg-status-green/15 text-status-green",
    },
  };
  const c = config[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em]",
        c.className,
      )}
    >
      {c.label}
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
  tone: "muted" | "yellow" | "red";
}) {
  const toneClass = {
    muted: "text-muted-foreground",
    yellow: "text-status-yellow",
    red: "text-status-red",
  }[tone];

  return (
    <div>
      <dt className="text-[0.55rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("mt-0.5 font-mono text-sm font-bold", toneClass)}>
        {value}
      </dd>
    </div>
  );
}
