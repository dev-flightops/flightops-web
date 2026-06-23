"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import type { FlightDetail } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { completeStepAction } from "./actions";

interface Props {
  flightId: string;
  flight: FlightDetail;
}

/**
 * Step 1 — Review Dispatch Release (Spec 4 §"The 8 steps / 1").
 *
 * Spec gate: pilot must scroll to the bottom of the release PDF
 * before the acknowledgment checkbox unlocks; then checkbox must
 * be ticked before the Continue button enables. Per spec this
 * creates the regulatory audit trail.
 *
 * MVP: the PDF preview is a styled summary panel (the existing
 * `/dispatch/{id}/release.pdf` exists but inline-PDF embed needs
 * its own work — a follow-up renders it via /api/preview or
 * pdf.js). Scroll-gate uses an IntersectionObserver on a sentinel
 * at the bottom of the panel.
 */
export function ReviewDispatchReleaseStep({ flightId, flight }: Props) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Scroll-to-bottom gate per Spec 4: "Pilot must scroll to the
  // bottom before the acknowledgment checkbox appears." IntersectionObserver
  // on a sentinel <div> below the release summary flips state when
  // it scrolls into view.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setScrolledToBottom(true);
      },
      { threshold: 1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const canSubmit = scrolledToBottom && acknowledged && !pending;

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await completeStepAction(flightId, 1, {
        acknowledged_at: new Date().toISOString(),
      });
      if (!result.ok) {
        setError(result.error ?? "Couldn't save — try again.");
      }
    });
  };

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="border-b border-border px-5 py-3">
        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
          Step 1
        </p>
        <h2 className="text-base font-semibold text-foreground">
          Review Dispatch Release
        </h2>
      </header>

      <div className="space-y-3 px-5 py-4 text-sm">
        <p className="text-muted-foreground">
          Read the full dispatch release for this flight including all
          weather, NOTAMs, compliance status, MEL items, and special
          instructions. Scroll to the bottom — the acknowledgment
          checkbox appears below.
        </p>

        <div className="max-h-80 space-y-3 overflow-y-auto rounded-lg border border-border bg-background p-4 text-xs leading-relaxed">
          <div>
            <span className="font-mono font-semibold text-foreground">
              {flight.flight_number}
            </span>
            <span className="ml-2 font-mono text-foreground">
              {flight.origin} → {flight.destination}
            </span>
          </div>
          <div className="text-muted-foreground">
            Aircraft <span className="font-mono">{flight.aircraft.tail_number}</span>
            {flight.aircraft.model ? ` · ${flight.aircraft.model}` : ""}
            {flight.pax_count != null ? ` · ${flight.pax_count} pax` : ""}
          </div>
          <div className="text-muted-foreground">
            ETD {formatUtc(flight.scheduled_departure_at)} ·{" "}
            ETA {formatUtc(flight.scheduled_arrival_at)}
          </div>
          {flight.notes && (
            <div className="border-l-2 border-status-yellow/40 bg-status-yellow/5 px-3 py-2 text-foreground">
              <span className="font-semibold uppercase tracking-[0.06em] text-status-yellow">
                Dispatcher notes
              </span>
              <p className="mt-1 whitespace-pre-wrap">{flight.notes}</p>
            </div>
          )}
          <p className="text-muted-foreground">
            Weather, NOTAMs, MEL items, and compliance status are
            reviewed in their dedicated steps (3 + ahead). This panel
            summarizes the dispatch release content the dispatcher
            generated; the full PDF is available from the flight's
            release link in dispatch.
          </p>
          {/* Sentinel — when this scrolls into view, the ack checkbox unlocks. */}
          <div
            ref={sentinelRef}
            className="border-t border-border pt-3 text-center text-[0.65rem] text-muted-foreground"
          >
            — end of release —
          </div>
        </div>

        <label
          className={cn(
            "flex items-start gap-2 rounded-md border px-3 py-2 text-xs transition-colors",
            scrolledToBottom
              ? "cursor-pointer border-border bg-card/40 text-foreground"
              : "cursor-not-allowed border-border/50 bg-card/20 text-muted-foreground/50",
          )}
          title={
            scrolledToBottom
              ? "Tick to acknowledge."
              : "Scroll to the bottom of the release first."
          }
        >
          <input
            type="checkbox"
            disabled={!scrolledToBottom}
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 h-4 w-4 cursor-pointer accent-status-blue disabled:cursor-not-allowed"
          />
          <span>
            I have read and understood this dispatch release including all
            weather, NOTAMs, compliance status, MEL items, and special
            instructions.
          </span>
        </label>

        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="inline-flex w-full items-center justify-center rounded-md bg-status-blue px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Continue to Step 2 →"}
        </button>

        {error && (
          <p role="alert" className="text-xs text-status-red">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

function formatUtc(iso: string): string {
  return `${iso.slice(11, 16)}Z`;
}
