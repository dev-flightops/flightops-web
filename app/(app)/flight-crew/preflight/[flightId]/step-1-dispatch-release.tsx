"use client";

import Link from "next/link";
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
 * Release gate: the pilot's acknowledgment is meaningless if no
 * release has been generated. The step renders in one of two
 * modes:
 *
 *   1. Awaiting release (flight.status !== 'released') — blocking
 *      state. No summary panel, no ack control. Copy tells the
 *      pilot to wait for dispatch, offers a link back to the
 *      Flight Crew board.
 *
 *   2. Released — release summary panel (flight ident + aircraft
 *      + who released + when), a prominent download link to the
 *      actual release PDF, the scroll-to-bottom sentinel, and the
 *      ack control. Only reachable via a real released row.
 *
 * Spec gate applies inside mode 2: pilot must scroll to the
 * bottom of the release panel before the acknowledgment checkbox
 * unlocks; then checkbox must be ticked before the Continue
 * button enables. Per spec this creates the regulatory audit
 * trail.
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

  // Release gate — before any acknowledgment control is shown, the
  // Flight row must have been transitioned to 'released' by the
  // dispatcher. Legacy peregrineflight (and FAR 135.77) treat the
  // dispatch release as a hard prerequisite: the pilot cannot
  // accept a flight that has no release on file.
  const isReleased =
    flight.status === "released" && flight.released_at !== null;

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

  // Belt-and-braces: even if a client bypasses the disabled button
  // and calls the action directly, this guard keeps the frontend
  // consistent. The backend already 409s complete-step-1 when the
  // flight isn't released (no dispatch-release row exists), but
  // stopping it here surfaces a clearer error to the pilot.
  const canSubmit =
    isReleased && scrolledToBottom && acknowledged && !pending;

  const handleSubmit = () => {
    if (!isReleased) {
      setError(
        "This flight hasn't been released yet — ask dispatch to release it first.",
      );
      return;
    }
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

      {!isReleased ? (
        <AwaitingReleasePanel flight={flight} />
      ) : (
        <div className="space-y-3 px-5 py-4 text-sm">
          <ReleasePublishedBanner flight={flight} />

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
              {flight.cargo_lbs != null ? ` · ${flight.cargo_lbs.toLocaleString()} lbs cargo` : ""}
            </div>
            <div className="text-muted-foreground">
              ETD {formatUtc(flight.scheduled_departure_at)} · ETA{" "}
              {formatUtc(flight.scheduled_arrival_at)}
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
              Weather, NOTAMs, MEL items, and compliance status live in
              their dedicated steps (3 + ahead) — this panel is the
              release header. Open the full PDF for the complete
              content the dispatcher generated.
            </p>
            <a
              href={`/api/dispatch/${flight.id}/release.pdf`}
              className="inline-flex items-center gap-1 rounded-md border border-status-blue/40 bg-status-blue/10 px-3 py-1.5 text-xs font-semibold text-status-blue hover:bg-status-blue/20"
              target="_blank"
              rel="noopener"
            >
              ↓ Open dispatch release PDF
            </a>
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
      )}
    </section>
  );
}

function AwaitingReleasePanel({ flight }: { flight: FlightDetail }) {
  const statusLabel =
    flight.status === "cancelled"
      ? "Flight cancelled"
      : "Awaiting dispatch release";
  return (
    <div className="space-y-3 px-5 py-6 text-sm">
      <div
        role="status"
        className="flex flex-col items-start gap-2 rounded-lg border border-status-yellow/40 bg-status-yellow/10 px-4 py-3"
      >
        <div className="flex items-center gap-2 text-status-yellow">
          <ClockIcon className="h-4 w-4" />
          <span className="text-sm font-semibold uppercase tracking-wider">
            {statusLabel}
          </span>
        </div>
        <p className="text-xs text-foreground/80">
          The dispatch release for{" "}
          <span className="font-mono font-semibold">{flight.flight_number}</span>{" "}
          hasn&rsquo;t been generated yet. You can&rsquo;t acknowledge a
          release that doesn&rsquo;t exist — this step unlocks once
          dispatch releases the packet.
        </p>
        <p className="text-xs text-muted-foreground">
          {flight.status === "cancelled"
            ? "The flight was cancelled — head back to the Flight Crew board."
            : "Check back after the dispatcher completes the packet, or head back to the Flight Crew board and open another flight."}
        </p>
      </div>
      <div className="rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">
        <div>
          <span className="font-mono font-semibold text-foreground">
            {flight.flight_number}
          </span>
          <span className="ml-2 font-mono text-foreground">
            {flight.origin} → {flight.destination}
          </span>
        </div>
        <div className="mt-1">
          Aircraft{" "}
          <span className="font-mono">{flight.aircraft.tail_number}</span>
          {flight.aircraft.model ? ` · ${flight.aircraft.model}` : ""} · ETD{" "}
          {formatUtc(flight.scheduled_departure_at)}
        </div>
      </div>
      <Link
        href="/flight-crew"
        className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-muted/10"
      >
        ← Back to Flight Crew
      </Link>
    </div>
  );
}

function ReleasePublishedBanner({ flight }: { flight: FlightDetail }) {
  const releasedByName = flight.released_by?.full_name ?? "Dispatcher";
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-2 rounded-lg border border-status-green/40 bg-status-green/10 px-3 py-2 text-xs"
    >
      <span className="font-semibold uppercase tracking-wider text-status-green">
        ✓ Release published
      </span>
      <span className="text-foreground/80">
        by {releasedByName}
      </span>
      <span className="text-muted-foreground">
        · {flight.released_at ? formatReleasedAt(flight.released_at) : ""}
      </span>
    </div>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .2.08.39.22.53l3 3a.75.75 0 101.06-1.06L10.75 9.69V5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function formatUtc(iso: string): string {
  return `${iso.slice(11, 16)}Z`;
}

function formatReleasedAt(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })} · ${d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  })}`;
}
