import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import { getDispatchSuggestions, type DispatchSuggestions } from "@/lib/api/ops";

import { OptionCard } from "./option-card";

/**
 * /dispatch/intelligence — next-leg suggestions for airborne aircraft.
 *
 * Legacy's `templates/dispatch/ai_assist.html`, reached from its nav as
 * "✨ Intelligence".
 *
 * WHY THE COPY DIFFERS FROM LEGACY'S
 *
 * Legacy's own explainer on this page reads:
 *
 *   "evaluates every feasible next-leg option against a multi-factor
 *    model (0–100). Rather than presenting the first legal option, it
 *    scores all options simultaneously so you optimize rather than
 *    satisfice."
 *
 * That 0–100 model is the thing services #214 removed. It priced hard
 * legal bars in the same currency as revenue — 40 points off for an
 * aircraft on hold, 20 for a pilot with no current type rating —
 * so with enough passengers booked an aircraft that cannot legally
 * fly outranked one that could, by thirteen points. Copy that
 * advertises the scoring would be advertising the defect.
 *
 * So there is no score on this page. Options carry a rank from a
 * documented precedence, every one states its own reason, and anything
 * that cannot legally be flown is shown with the reason and carries no
 * rank at all.
 *
 * NO APPROVE BUTTON YET
 *
 * Legacy has `POST /dispatch/ai-assist/approve`, which creates the
 * flight from an option. Deliberately not in this page: it writes, and
 * it deserves its own change rather than being bolted onto a read-only
 * board. The page says so rather than leaving a dispatcher hunting for
 * the button.
 */

export const dynamic = "force-dynamic";

function hhmmZ(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(
    d.getUTCMinutes(),
  ).padStart(2, "0")}Z`;
}

export default async function DispatchIntelligencePage() {
  let data: DispatchSuggestions | null = null;
  let loadError: string | null = null;

  try {
    data = await getDispatchSuggestions();
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 403
        ? "Dispatch Intelligence is limited to dispatchers, the chief pilot and the director of operations."
        : "Could not load suggestions just now.";
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link
        href="/dispatch"
        className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        ← Dispatch
      </Link>
      <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
        <span aria-hidden className="text-status-purple">
          ✦
        </span>
        Dispatch Intelligence
      </h1>
      {data && (
        <p className="mt-1 text-sm text-muted-foreground">
          {data.inbound.length} aircraft airborne · {data.turn_minutes}-minute
          turn assumed · as at {hhmmZ(data.generated_at)}
        </p>
      )}

      {loadError ? (
        <p
          role="alert"
          className="mt-5 rounded-md border border-status-red/30 bg-status-red/10 px-3 py-2 text-sm text-status-red"
        >
          {loadError}
        </p>
      ) : data ? (
        <>
          <p className="mt-4 rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
            {data.advisory}
          </p>

          {data.note ? (
            <p className="mt-4 rounded-lg border border-dashed border-border bg-card/40 px-4 py-14 text-center text-sm text-muted-foreground">
              {data.note}
            </p>
          ) : (
            <div className="mt-5 space-y-5">
              {data.inbound.map((ac) => (
                <section
                  key={ac.flight_id}
                  // Keyed on the flight, not the tail: one aircraft can
                  // be recorded as airborne on two flights, and that is
                  // exactly the case the board is built to surface.
                  data-testid={`inbound-${ac.flight_id}`}
                  className="rounded-xl border border-border bg-background/40 p-4"
                >
                  <header className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-mono text-base font-bold text-foreground">
                        {ac.tail_number}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {ac.flight_number} · {ac.origin}-{ac.destination}
                      </span>
                      {ac.aircraft_type && (
                        <span className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                          {ac.aircraft_type}
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-2 text-[0.7rem] text-muted-foreground">
                      {ac.pic_name && <span>PIC {ac.pic_name}</span>}
                      <span className="font-mono">
                        arr {hhmmZ(ac.scheduled_arrival)}
                      </span>
                    </div>
                  </header>

                  {ac.arrival_overdue && (
                    // Worth seeing in its own right, not just as a
                    // footnote to the turn calculation: an aircraft
                    // still airborne past its scheduled arrival is
                    // either late or has a missing arrival record.
                    <p
                      role="status"
                      className="mt-2 rounded border border-status-yellow/30 bg-status-yellow/10 px-2 py-1 text-[0.7rem] text-status-yellow"
                    >
                      Still airborne past its scheduled arrival. Departure
                      times below are measured from now rather than from the
                      schedule.
                    </p>
                  )}

                  {ac.aircraft_blockers.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {ac.aircraft_blockers.map((b) => (
                        <li
                          key={b.code}
                          data-testid={`ac-blocker-${b.code}`}
                          className="rounded border border-status-red/30 bg-status-red/10 px-2 py-1 text-[0.7rem] text-status-red"
                        >
                          <span className="font-semibold uppercase tracking-wider">
                            {b.source}
                          </span>{" "}
                          — {b.detail}
                        </li>
                      ))}
                    </ul>
                  )}

                  <ul className="mt-3 space-y-2">
                    {ac.options.map((o) => (
                      <OptionCard key={o.option_id} option={o} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          <p className="mt-5 text-xs text-muted-foreground">
            Assigning a suggestion to a flight is not built yet — this board
            reads, it does not write. Build the leg in Dispatch as usual.
          </p>
        </>
      ) : null}
    </div>
  );
}
