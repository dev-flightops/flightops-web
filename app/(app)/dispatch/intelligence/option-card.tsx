import type { DispatchOption } from "@/lib/api/ops";

/**
 * One next-leg option.
 *
 * Presentational and separate from the page so it renders under
 * vitest, and because the blocked/rankable distinction is the part
 * worth testing rather than eyeballing.
 *
 * Legacy's card leads with a 0–100 score and a STRONG / CONSIDER /
 * LOW PRIORITY label derived from it. There is no score here, so the
 * card leads with the rank and the reason — see the page's own comment
 * for why the score went.
 */

const KIND_LABEL: Record<string, string> = {
  continue_schedule: "Scheduled flight",
  reposition_home: "Reposition",
  hold: "Hold",
};

/** UTC HH:MM. Proposed departures are compared against a schedule, so
 *  rendering them in the viewer's zone would shift them. */
function hhmmZ(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(
    d.getUTCMinutes(),
  ).padStart(2, "0")}Z`;
}

function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function OptionCard({ option }: { option: DispatchOption }) {
  const blocked = option.blockers.length > 0;
  // Aircraft-level reasons are stated once on the section header — the
  // service stamps them onto every option so nothing downstream can
  // rank a blocked leg by accident, but repeating "Grounded since…"
  // under each of three options is noise. The BLOCKED badge carries
  // the fact; anything option-specific still gets listed.
  const ownBlockers = option.blockers.filter((b) => b.source !== "aircraft");

  return (
    <li
      data-testid={`option-${option.option_id}`}
      className={
        "rounded-lg border px-4 py-3 " +
        (blocked
          ? // Muted rather than red. The option is not an error — it is
            // a leg somebody will want to fly once the blocker clears,
            // and red would put it in the same visual class as a
            // weight-and-balance return.
            "border-border bg-card/40"
          : "border-border bg-card")
      }
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          {blocked ? (
            <span className="rounded border border-status-yellow/40 bg-status-yellow/10 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-status-yellow">
              Blocked
            </span>
          ) : (
            <span className="rounded bg-primary px-1.5 py-0.5 text-[0.65rem] font-bold tabular-nums text-white">
              {option.rank}
            </span>
          )}
          <span className="font-mono text-sm font-semibold text-foreground">
            {option.summary}
          </span>
        </div>
        <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
          {KIND_LABEL[option.kind] ?? option.kind}
        </span>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">{option.reason}</p>

      {ownBlockers.length > 0 && (
        <ul className="mt-2 space-y-1">
          {ownBlockers.map((b) => (
            <li
              key={b.code}
              className="text-xs text-status-yellow"
              data-testid={`blocker-${b.code}`}
            >
              {b.detail}
            </li>
          ))}
        </ul>
      )}

      {option.factors.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {option.factors.map((f) => (
            <li
              key={f.detail}
              className={
                "text-[0.7rem] " +
                (f.tone === "caution"
                  ? "text-status-yellow"
                  : "text-muted-foreground")
              }
            >
              {f.tone === "caution" ? "! " : "· "}
              {f.detail}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-2 text-[0.7rem] text-muted-foreground">
        {option.proposed_etd && <span>ETD {hhmmZ(option.proposed_etd)}</span>}
        {option.pax_count > 0 && <span>{option.pax_count} pax</span>}
        {option.cargo_lbs > 0 && (
          <span>{option.cargo_lbs.toLocaleString("en-US")} lb cargo</span>
        )}
        {option.cost.configured && option.cost.total_cents !== null ? (
          <span className="tabular-nums">
            est. {money(option.cost.total_cents)}
          </span>
        ) : option.kind !== "hold" ? (
          // Named rather than hidden, and never a guessed figure. The
          // service returns exactly what is unconfigured; legacy falls
          // back to $450/hr and prints the result as money.
          <span
            className="text-status-yellow"
            title={option.cost.missing.join("; ")}
          >
            no cost — rates not configured
          </span>
        ) : null}
      </div>
    </li>
  );
}
