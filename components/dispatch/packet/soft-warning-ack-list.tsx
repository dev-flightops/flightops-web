"use client";

import { SpinnerGlyph } from "@/components/ff/glyphs";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import type { CrewSeat } from "@/lib/api/ops";
import type { ComplianceFinding } from "@/lib/api/types";

import {
  findingKey,
  findingMessage,
  parseAckedWarns,
  warningAckKey,
} from "./soft-warning-ack-parser";
import { useDispatchQuery } from "./use-dispatch-query";

/**
 * M2-G-5 tail — soft-warning acknowledgment checkboxes.
 *
 * Spec 5: "Soft warnings — dispatcher must acknowledge". Each
 * warning gets an inline checkbox. Ack state persists in the URL as
 * `?warns_acked=code1,code2` so refresh and share preserve the acks
 * (matches the NOTAM + MEL ack patterns already in use on the packet).
 *
 * Toggling any checkbox replaces the URL without scrolling, as those do
 * — the server re-renders and the acked warning line flips to a
 * completed style. A push used to scroll the dispatcher back to the top
 * of the page on every tick (#70). When ALL soft warnings are acked, the
 * parent enables Generate PDF (see page.tsx).
 *
 * A tick shows at once, and ticks in a row go to the URL together once
 * they stop (#145). Each tick used to wait for the whole packet to render
 * again, 5-10 s on the demo, with every box disabled meanwhile: the
 * client's nine warnings took over a minute. "Acknowledge all" does them
 * in one go.
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

/** How long ticks in a row wait for the next before the URL takes them. */
export const TICK_SETTLE_MS = 500;

export function SoftWarningAckList({
  findings,
  ackedCodes,
  seat = "pic",
}: {
  findings: ComplianceFinding[];
  /** Ack keys the dispatcher has already ticked (from URL). */
  ackedCodes: ReadonlySet<string>;
  /** Whose warnings these are. The SIC's are keyed "sic:<code>". */
  seat?: CrewSeat;
}) {
  const router = useRouter();
  const nextQuery = useDispatchQuery();
  const [pending, startTransition] = useTransition();
  // Ticks the URL doesn't show yet, by ack key: what the box should read.
  const [ticked, setTicked] = useState<ReadonlyMap<string, boolean>>(() => new Map());
  const latest = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Once the URL shows a tick, the box reads it from there again.
  const shownKey = Array.from(ackedCodes).sort().join(",");
  useEffect(() => {
    const shown = new Set(shownKey ? shownKey.split(",") : []);
    setTicked((prev) => {
      const still = Array.from(prev).filter(([key, on]) => shown.has(key) !== on);
      return still.length === prev.size ? prev : new Map(still);
    });
  }, [shownKey]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const isAcked = (key: string) => ticked.get(key) ?? ackedCodes.has(key);

  const send = () => {
    timer.current = null;
    const qs = latest.current;
    startTransition(() => {
      router.replace(qs ? `/dispatch/?${qs}` : "/dispatch/", { scroll: false });
    });
  };

  const change = (keys: string[], on: boolean, settle = TICK_SETTLE_MS) => {
    setTicked((prev) => {
      const next = new Map(prev);
      for (const key of keys) next.set(key, on);
      return next;
    });
    latest.current = nextQuery((params) => {
      const nextAcks = parseAckedWarns(params.get("warns_acked") ?? undefined);
      for (const key of keys) {
        if (on) nextAcks.add(key);
        else nextAcks.delete(key);
      }
      if (nextAcks.size === 0) params.delete("warns_acked");
      else params.set("warns_acked", Array.from(nextAcks).sort().join(","));
    });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(send, settle);
  };

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
          <SpinnerGlyph className="h-3 w-3 animate-spin" aria-hidden /> Updating the packet…
        </li>
      )}
    </ul>
  );
}

// parseAckedWarns + allSoftAcked live in ./soft-warning-ack-parser
// (a plain, server-safe module) so page.tsx can call parseAckedWarns
// during server rendering. Re-export here for callers that already
// import from this file.
export { allSoftAcked, parseAckedWarns } from "./soft-warning-ack-parser";
