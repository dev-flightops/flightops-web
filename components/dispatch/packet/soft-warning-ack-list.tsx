"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

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
 * `?warns_acked=code1,code2` so refresh / share / back-button
 * preserve the acks (matches the NOTAM + MEL ack patterns already
 * in use on the packet).
 *
 * Toggling any checkbox does an optimistic navigation via
 * router.push — the server re-renders and the acked warning line
 * flips to a completed style. When ALL soft warnings are acked, the
 * parent enables Generate PDF (see page.tsx).
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

  const toggle = (code: string, next: boolean) => {
    const qs = nextQuery((params) => {
      const nextAcks = parseAckedWarns(params.get("warns_acked") ?? undefined);
      if (next) nextAcks.add(code);
      else nextAcks.delete(code);
      if (nextAcks.size === 0) params.delete("warns_acked");
      else params.set("warns_acked", Array.from(nextAcks).sort().join(","));
    });
    startTransition(() => {
      router.push(qs ? `/dispatch/?${qs}` : "/dispatch/");
    });
  };

  return (
    <ul className="mt-2 space-y-1 text-[0.7rem]">
      {findings.map((f) => {
        const key = warningAckKey(seat, f.code);
        const acked = ackedCodes.has(key);
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
              disabled={pending}
              onChange={(e) => toggle(key, e.target.checked)}
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
      {pending && (
        <li className="flex items-center gap-1 text-[0.6rem] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> Saving…
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
