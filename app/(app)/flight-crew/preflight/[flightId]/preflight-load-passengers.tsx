import Link from "next/link";

import { linkCaps } from "@/components/ff/controls";
import { StatusMark, type StatusTone } from "@/components/ff/status-mark";
import { LoadStatusLine } from "@/components/load-teams/load-status";
import type { ManifestDetailResponse, ManifestPaxRow } from "@/lib/api/manifest";
import type { FlightAssignmentResponse } from "@/lib/api/types";
import { localClock } from "@/lib/format/local-time";

/**
 * The load and the passengers, beside the fuel on every preflight step
 * (20 Nov). The client: "Can we get a load/passenger checked in status on
 * the flight screen as well? Just like the fuel shows completed. An all pax
 * checked in and a load complete confirmation for pilots would be great
 * for closing the communication loop."
 */

const BOX = "mt-6 rounded-lg border border-border bg-card p-5";

export function PreflightLoad({
  assignment,
  timeZone,
}: {
  /** null: no load team on the flight; undefined: it couldn't be read. */
  assignment: FlightAssignmentResponse | null | undefined;
  timeZone: string;
}) {
  return (
    <section aria-labelledby="preflight-load-heading" className={BOX}>
      <h2 id="preflight-load-heading" className="panel-title mb-3">
        Load
      </h2>
      {assignment === undefined ? (
        <p role="alert" className="notice notice-yellow">
          Load unavailable — try refreshing in a moment.
        </p>
      ) : assignment === null ? (
        <p className="text-sm text-muted-foreground">
          No load team on it yet. Dispatch assigns one on the packet.
        </p>
      ) : (
        <div className="rounded-md border border-border px-4 py-3 text-sm">
          <LoadStatusLine assignment={assignment} timeZone={timeZone} />
          <p className="mt-1 text-xs text-muted-foreground">{assignment.load_team.team_name}</p>
        </div>
      )}
    </section>
  );
}

const STATUS: Record<NonNullable<ManifestPaxRow["check_in_status"]>, { label: string; tone: StatusTone }> = {
  booked: { label: "To check in", tone: "yellow" },
  checked_in: { label: "Checked in", tone: "green" },
  boarded: { label: "Boarded", tone: "green" },
  no_show: { label: "No-show", tone: "gray" },
};

/** The passengers on the manifest, crew aside, and where each one is. */
export function passengersOf(manifest: ManifestDetailResponse | null): ManifestPaxRow[] {
  return (manifest?.pax ?? []).filter((p) => !p.is_crew);
}

export function PreflightPassengers({
  flightId,
  manifest,
  timeZone,
}: {
  flightId: string;
  /** null: no manifest yet; undefined: it couldn't be read. */
  manifest: ManifestDetailResponse | null | undefined;
  timeZone: string;
}) {
  const pax = passengersOf(manifest ?? null);
  const expected = pax.filter((p) => p.check_in_status !== "no_show");
  const inCount = expected.filter((p) => p.check_in_status === "checked_in" || p.check_in_status === "boarded").length;
  const all = expected.length > 0 && inCount === expected.length;
  return (
    <section aria-labelledby="preflight-passengers-heading" className={BOX}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="preflight-passengers-heading" className="panel-title">
          Passengers
        </h2>
        <Link href={`/check-in/${flightId}`} className={linkCaps}>
          Check in passengers ›
        </Link>
      </div>
      {manifest === undefined ? (
        <p role="alert" className="notice notice-yellow">
          Passengers unavailable — try refreshing in a moment.
        </p>
      ) : expected.length === 0 ? (
        <p className="text-sm text-muted-foreground">No passengers on the manifest.</p>
      ) : (
        <div className="rounded-md border border-border px-4 py-3 text-sm">
          <StatusMark
            label={all ? `All ${expected.length} checked in` : `${inCount} of ${expected.length} checked in`}
            tone={all ? "green" : "yellow"}
          />
          <ul className="mt-2 space-y-1">
            {pax.map((p) => {
              const state = STATUS[p.check_in_status ?? "booked"];
              const at = p.check_in_status === "boarded" ? p.boarded_at : p.check_in_status === "checked_in" ? p.checked_in_at : null;
              return (
                <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
                  <span className="text-foreground">{`${p.first_name} ${p.last_name}`}</span>
                  <span className="text-muted-foreground">
                    {at ? `${state.label} ${localClock(at, timeZone)}` : state.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
