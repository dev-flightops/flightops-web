"use client";

import { SpinnerGlyph } from "@/components/ff/glyphs";

import type { CrewSeat } from "@/lib/api/ops";
import type { ComplianceFinding } from "@/lib/api/types";

import { findingKey, findingMessage, warningAckKey } from "./soft-warning-ack-parser";
import { useSavedAcks } from "./use-saved-acks";

/**
 * M2-G-5 tail — soft-warning acknowledgment checkboxes.
 *
 * Spec 5: "Soft warnings — dispatcher must acknowledge". Each warning
 * gets an inline checkbox. Each tick is saved against the dispatcher who
 * made it, with its time (#155): they used to live in the page's link,
 * so a pre-filled link opened with every warning acknowledged. Only the
 * viewer's own ticks show as theirs, and only theirs count toward their
 * release.
 *
 * A tick shows at once, and ticks in a row are saved together once they
 * stop (#145, #155). "Acknowledge all" does them in one go.
 */
/**
 * The checkbox's accessible name. An SIC item already says so ("SIC IFR
 * Currency"); one either seat holds, like a medical, says whose it is,
 * or the PIC's box and the SIC's would read the same.
 */
function ackLabel(seat: CrewSeat, name: string): string {
  if (seat === "pic" || /^SIC\b/.test(name)) return `Acknowledge ${name}`;
  return `Acknowledge ${name} (SIC)`;
}

export { TICK_SETTLE_MS } from "./use-saved-acks";

export function SoftWarningAckList({
  flightId,
  findings,
  ackedCodes,
  seat = "pic",
}: {
  flightId: string;
  findings: ComplianceFinding[];
  /** Ack keys the viewer has ticked, as saved. */
  ackedCodes: ReadonlySet<string>;
  /** Whose warnings these are. The SIC's are keyed "sic:<code>". */
  seat?: CrewSeat;
}) {
  const { isOn: isAcked, change: save, pending, error } = useSavedAcks(
    flightId,
    "soft_warning",
    ackedCodes,
  );
  const detail = (key: string) => {
    const f = findings.find((x) => warningAckKey(seat, x.code) === key);
    return f ? { name: f.name, message: findingMessage(f) } : null;
  };
  const change = (keys: string[], on: boolean, settle?: number) => save(keys, on, detail, settle);

  const unacked = findings.map((f) => warningAckKey(seat, f.code)).filter((key) => !isAcked(key));

  return (
    <ul className="mt-2 space-y-1 text-[0.7rem]">
      {findings.map((f) => {
        const key = warningAckKey(seat, f.code);
        const acked = isAcked(key);
        const id = `warn-ack-${seat}-${f.code}`;
        return (
          <li
            key={findingKey(f)}
            className={
              "flex items-start gap-2 rounded-md border px-2 py-1.5 transition-colors " +
              (acked
                ? "border-status-green/30 bg-status-green/[0.06]"
                : "border-status-yellow/30 bg-status-yellow/[0.04]")
            }
          >
            <input
              id={id}
              type="checkbox"
              checked={acked}
              onChange={(e) => change([key], e.target.checked)}
              aria-label={ackLabel(seat, f.name)}
              className="mt-0.5 h-3 w-3 shrink-0 cursor-pointer accent-status-green"
            />
            <label
              htmlFor={id}
              className={
                "min-w-0 flex-1 cursor-pointer " +
                (acked ? "text-foreground/70 line-through" : "text-foreground/90")
              }
            >
              <span className="font-semibold">{f.name}</span>
              <span className="text-muted-foreground"> ({f.regulation})</span>
              {" — "}
              <span>{findingMessage(f)}</span>
            </label>
            {acked && (
              <span className="shrink-0 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-status-green">
                Ack'd
              </span>
            )}
          </li>
        );
      })}
      {findings.length > 1 && unacked.length > 0 ? (
        <li className="flex justify-end pt-1">
          <button
            type="button"
            onClick={() => change(unacked, true, 0)}
            className="btn-caps rounded-md border border-primary/40 bg-background px-3 py-1 text-primary hover:bg-primary/5 text-[0.68rem]"
          >
            Acknowledge all
          </button>
        </li>
      ) : null}
      {pending && (
        <li className="flex items-center gap-1 text-[0.6rem] text-muted-foreground">
          <SpinnerGlyph className="h-3 w-3 animate-spin" aria-hidden /> Saving…
        </li>
      )}
      {error ? (
        <li role="alert" className="field-error">
          {error}
        </li>
      ) : null}
    </ul>
  );
}

// parseAckedWarns + allSoftAcked live in ./soft-warning-ack-parser
// (a plain, server-safe module) so page.tsx can call parseAckedWarns
// during server rendering. Re-export here for callers that already
// import from this file.
export { allSoftAcked, parseAckedWarns } from "./soft-warning-ack-parser";
