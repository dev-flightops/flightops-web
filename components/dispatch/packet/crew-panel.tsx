"use client";

import { Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  assignCrewAction,
  unassignCrewAction,
} from "@/app/(app)/dispatch/crew-actions";
import type {
  CrewAssignment,
  CrewRole,
} from "@/lib/api/crew-assignments";
import type { CurrencyStatus, UserRef } from "@/lib/api/types";

/**
 * Crew for the selected flight, on the dispatch packet.
 *
 * The packet already had a PIC dropdown, but it wrote its choice to
 * `?pic=<uuid>` and nowhere else — the dispatcher picked a pilot, read
 * their currency, released the flight, and the assignment left with the
 * URL. The pilot's own "My Flights today" never heard about it. This
 * panel is where the choice becomes a row in flight_crew_assignments
 * (flightops-services#171).
 *
 * Legacy shape, deliberately not copied twice over:
 *   - its PIC field is a searchable combobox that resolves to a user;
 *     ours is a dropdown carrying the same currency dots the compliance
 *     grid uses, so a dispatcher can pre-screen without opening a
 *     profile. Same job, one fewer way to typo a name.
 *   - its SIC field is `<input placeholder="Last, First (optional)">` —
 *     free text, resolved against nothing. Ours picks a real user, for
 *     the same reason the whole table exists.
 *
 * Currency is shown, never enforced. Rostering a pilot before their
 * check ride is ordinary planning; flying them is not, and the release
 * gate below already refuses that.
 */

// Same mapping as PicPicker and the compliance grid — a dispatcher
// glancing between them should not have to re-learn the colours.
const STATUS_TO_DOT: Record<CurrencyStatus, "green" | "yellow" | "red"> = {
  not_started: "yellow",
  upcoming: "green",
  early_month: "green",
  due_this_month: "yellow",
  grace_month: "yellow",
  non_current: "red",
};

const STATUS_LABEL: Record<CurrencyStatus, string> = {
  not_started: "Not started",
  upcoming: "Upcoming",
  early_month: "Fully current",
  due_this_month: "Due this month",
  grace_month: "Grace month",
  non_current: "NON-CURRENT",
};

const DOT_CLASS = {
  green: "bg-status-green",
  yellow: "bg-status-yellow",
  red: "bg-status-red",
} as const;

export interface CrewCandidate {
  pilot: UserRef;
  status: CurrencyStatus;
}

// PIC is deliberately absent from this list. It is picked in Flight
// Details above, which is where legacy puts it and where a dispatcher
// already looks — legacy calls its equivalent the "SINGLE CONSOLIDATED
// PILOT FIELD ... only way to pick a pilot". A second PIC dropdown down
// here would leave a dispatcher guessing which one counts. The PIC still
// SHOWS in this panel, read-only, because a crew list missing its
// captain is not a crew list.
const SEATS: { role: CrewRole; label: string; required: boolean }[] = [
  { role: "sic", label: "SIC", required: false },
  { role: "flight_attendant", label: "Flight Attendant", required: false },
];

export function CrewPanel({
  flightId,
  assignments,
  candidates,
}: {
  flightId: string;
  assignments: CrewAssignment[];
  candidates: CrewCandidate[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const bySeat = new Map(assignments.map((a) => [a.crew_role, a]));
  const pic = bySeat.get("pic") ?? null;
  const picCandidate = pic
    ? candidates.find((c) => c.pilot.id === pic.user.id)
    : undefined;

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="flex items-baseline justify-between border-b border-border px-5 py-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Crew
        </h2>
        {!bySeat.has("pic") ? (
          <span className="text-[0.68rem] font-semibold uppercase tracking-[0.04em] text-status-yellow">
            No PIC assigned
          </span>
        ) : null}
      </header>

      <div className="divide-y divide-border">
        {/* PIC, read-only — assigned by the picker in Flight Details. */}
        <div className="flex items-center gap-3 px-5 py-3">
          <span className="w-32 shrink-0 text-xs font-semibold text-foreground">
            PIC
            <span className="ml-1 text-status-yellow" aria-hidden="true">
              *
            </span>
          </span>
          {pic ? (
            <span className="flex min-w-0 flex-1 items-center gap-2">
              {picCandidate ? (
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${DOT_CLASS[STATUS_TO_DOT[picCandidate.status]]}`}
                  aria-hidden="true"
                />
              ) : null}
              <span className="truncate text-sm text-foreground">
                {pic.user.full_name}
              </span>
              {picCandidate ? (
                <span className="shrink-0 text-[0.68rem] text-muted-foreground">
                  {STATUS_LABEL[picCandidate.status]}
                </span>
              ) : null}
            </span>
          ) : (
            <span className="flex-1 text-sm italic text-muted-foreground">
              Not assigned — pick a PIC in Flight Details above.
            </span>
          )}
        </div>

        {SEATS.map(({ role, label, required }) => {
          const assigned = bySeat.get(role);
          // A pilot holds one seat per flight, so anyone already on the
          // roster in another seat is not offered here — picking them
          // would be a move, and the dispatcher should take them out of
          // the other seat deliberately rather than by side effect.
          const taken = new Set(
            assignments.filter((a) => a.crew_role !== role).map((a) => a.user.id),
          );
          const options = candidates.filter((c) => !taken.has(c.pilot.id));
          const current = assigned
            ? candidates.find((c) => c.pilot.id === assigned.user.id)
            : undefined;

          return (
            <div key={role} className="flex items-center gap-3 px-5 py-3">
              <span className="w-32 shrink-0 text-xs font-semibold text-foreground">
                {label}
                {required ? (
                  <span className="ml-1 text-status-yellow" aria-hidden="true">
                    *
                  </span>
                ) : null}
              </span>

              {assigned ? (
                <>
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    {current ? (
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${DOT_CLASS[STATUS_TO_DOT[current.status]]}`}
                        aria-hidden="true"
                      />
                    ) : null}
                    <span className="truncate text-sm text-foreground">
                      {assigned.user.full_name}
                    </span>
                    {current ? (
                      <span className="shrink-0 text-[0.68rem] text-muted-foreground">
                        {STATUS_LABEL[current.status]}
                      </span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(() => unassignCrewAction(flightId, assigned.user.id))
                    }
                    aria-label={`Remove ${assigned.user.full_name} as ${label}`}
                    className="shrink-0 rounded-md border border-border p-1 text-muted-foreground transition-colors hover:border-status-red/40 hover:text-status-red disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <select
                  aria-label={`Assign ${label}`}
                  disabled={pending}
                  value=""
                  onChange={(e) =>
                    e.target.value &&
                    run(() => assignCrewAction(flightId, e.target.value, role))
                  }
                  className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
                >
                  <option value="">
                    {required ? "Select a pilot…" : "Unassigned"}
                  </option>
                  {options.map(({ pilot, status }) => (
                    <option key={pilot.id} value={pilot.id}>
                      {pilot.full_name} — {STATUS_LABEL[status]}
                    </option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>

      {pending ? (
        <p className="flex items-center gap-2 border-t border-border px-5 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          Updating crew…
        </p>
      ) : null}

      {error ? (
        // The backend writes these to be read — "Ann Pilot is already PIC
        // on PGR900" tells the dispatcher who to stand down. Shown as-is.
        <p
          role="alert"
          className="border-t border-status-red/30 bg-status-red/5 px-5 py-2.5 text-xs text-status-red"
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}
