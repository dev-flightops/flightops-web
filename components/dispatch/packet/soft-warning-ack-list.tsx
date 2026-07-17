"use client";

import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import type { ComplianceFinding } from "@/lib/api/types";

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
export function SoftWarningAckList({
  findings,
  ackedCodes,
}: {
  findings: ComplianceFinding[];
  /** Currency-item codes the dispatcher has already ack'd (from URL). */
  ackedCodes: ReadonlySet<string>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const toggle = (code: string, next: boolean) => {
    const nextAcks = new Set(ackedCodes);
    if (next) nextAcks.add(code);
    else nextAcks.delete(code);
    const params = new URLSearchParams(searchParams.toString());
    if (nextAcks.size === 0) params.delete("warns_acked");
    else params.set("warns_acked", Array.from(nextAcks).sort().join(","));
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/dispatch/?${qs}` : "/dispatch/");
    });
  };

  return (
    <ul className="mt-2 space-y-1 text-[0.7rem]">
      {findings.map((f) => {
        const acked = ackedCodes.has(f.code);
        const id = `warn-ack-${f.code}`;
        return (
          <li
            key={f.currency_item_id}
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
              onChange={(e) => toggle(f.code, e.target.checked)}
              aria-label={`Acknowledge ${f.name}`}
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
              <span>{f.message}</span>
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

export function parseAckedWarns(
  param: string | string[] | undefined,
): Set<string> {
  if (!param) return new Set();
  const raw = Array.isArray(param) ? param[0] : param;
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );
}

export function allSoftAcked(
  findings: ComplianceFinding[],
  ackedCodes: ReadonlySet<string>,
): boolean {
  return findings.every((f) => ackedCodes.has(f.code));
}
