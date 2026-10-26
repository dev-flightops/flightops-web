"use client";

import { useEffect, useState, useTransition } from "react";

import { buttonSolid } from "@/components/ff/controls";
import { Notice } from "@/components/ff/notice";
import type { Opening, OpeningPassenger } from "@/lib/api/open-seats";
import { localClock } from "@/lib/format/local-time";

import { refreshOpeningAction, textOpeningAction } from "./open-seats-actions";

/** How soon a no-show marked on the board shows here. */
const REFRESH_MS = 20_000;

/**
 * The seats a no-show opened on this flight (#120), at the top of the
 * gate page: which legs, who is waiting for them, and how each was told.
 * The client: "let the Hooper agent/dispatch know that another spot has
 * opened up ... and let a revenue or standby passenger know there is a
 * seat available", by text when there is a number, "option two - [the
 * company's] team can reach out directly" when there isn't.
 *
 * Its own client component, looking again every few seconds and when the
 * window regains focus, so the board stays as it is.
 */
export function OpenSeatsPanel({
  flightId,
  initial,
  canAct,
  timeZone,
}: {
  flightId: string;
  initial: Opening | null;
  canAct: boolean;
  /** The departure base's zone, for when texts went. */
  timeZone: string;
}) {
  const [opening, setOpening] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [sending, startSending] = useTransition();

  useEffect(() => {
    let alive = true;
    const look = async () => {
      const next = await refreshOpeningAction(flightId);
      if (alive && next.opening !== undefined) setOpening(next.opening);
    };
    const timer = window.setInterval(() => void look(), REFRESH_MS);
    const onFocus = () => void look();
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [flightId]);

  if (!opening) return null;
  const legs = opening.legs.map((l) => `${l.origin} → ${l.destination}: ${l.open} open`).join(" · ");
  const toText = opening.waiting.filter((p) => p.phone && p.text?.status !== "sent");
  const kept = opening.waiting.some((p) => p.text?.reason === "no_account");

  const send = () =>
    startSending(async () => {
      const next = await textOpeningAction(flightId);
      if (next.opening !== undefined) setOpening(next.opening);
      setError(next.error ?? null);
    });

  return (
    <section aria-label="Seats open" className="mb-6 space-y-2">
      <Notice tone="yellow" label="Seat open">
        <p className="mt-1 text-sm">{legs}</p>
        <p className="text-xs text-muted-foreground">
          {`No-show: ${opening.no_shows.map((p) => `${p.name} (${p.boards_at} → ${p.leaves_at})`).join("; ")}`}
        </p>
        {opening.waiting.length === 0 ? (
          <p className="mt-2 text-xs">No one on the manifest is waiting for these seats.</p>
        ) : (
          <ul aria-label="Waiting for a seat" className="mt-2 divide-y divide-border text-xs">
            {opening.waiting.map((p) => (
              <li key={p.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-1.5">
                <span className="font-semibold">{p.name}</span>
                <span className="font-mono">{`${p.boards_at} → ${p.leaves_at}`}</span>
                {p.phone ? <span className="font-mono">{p.phone}</span> : null}
                <span className="text-muted-foreground">{howTold(p, timeZone)}</span>
              </li>
            ))}
          </ul>
        )}
        {kept && !opening.can_text ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Texts are kept until the company&apos;s text-message account is set up in Settings → Integrations.
          </p>
        ) : null}
        {canAct && opening.can_text && toText.length > 0 ? (
          <div className="mt-3">
            <button type="button" onClick={send} disabled={sending} className={buttonSolid}>
              {sending ? "Sending…" : toText.length === 1 ? "Send the text" : `Send ${toText.length} texts`}
            </button>
          </div>
        ) : null}
      </Notice>
      {error ? <Notice tone="red">{error}</Notice> : null}
    </section>
  );
}

/** How a waiting passenger was told, or that the team has to. */
export function howTold(p: OpeningPassenger, timeZone: string): string {
  if (!p.phone) return "No phone: call them";
  const text = p.text;
  if (!text) return "Not texted yet";
  if (text.status === "sent") return text.sent_at ? `Texted ${localClock(text.sent_at, timeZone)}` : "Texted";
  if (text.reason === "phone_not_usable") return "Number can't be texted: call them";
  if (text.status === "failed") return `Text failed: ${text.reason ?? "no reason given"}`;
  return "Text kept, not sent: no text-message account";
}
