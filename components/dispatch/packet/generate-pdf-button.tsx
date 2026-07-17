"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { releaseFlightAction } from "@/app/(app)/dispatch/[flightId]/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FlightDetail } from "@/lib/api/types";

/**
 * Generate-PDF action on the /dispatch/ packet form. Three states:
 *
 *   1. No flight selected           → disabled button with hint tooltip.
 *   2. Flight selected, released    → direct anchor to the per-flight
 *                                     release PDF endpoint (opens new tab).
 *   3. Flight selected, scheduled   → opens a confirm dialog. Click
 *                                     "Release & generate" → calls the
 *                                     release server action, then opens
 *                                     the PDF in a new tab.
 *
 * This is the M1 stop-gap. In M2-M3 the form-level Generate PDF will
 * swap to a `POST /ops/dispatch/packet` server action that mirrors the
 * legacy single-submit packet generation (legality + currency +
 * airworthiness + MEL + NOTAM + weather + risk validated server-side).
 */

const BUTTON_CLASS =
  "inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground";

const PdfIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
  </svg>
);

export function GeneratePdfButton({
  flight,
  hardBlockReason = null,
  pilotUserId = null,
}: {
  flight: FlightDetail | null;
  /** M2-G-5 — when set, disable the button and surface the reason as
   *  a tooltip. Compliance gate hard blocks route through here so
   *  the dispatcher can't release a PIC who's non-current. */
  hardBlockReason?: string | null;
  /** M2-M-5 — currently-selected PIC (?pic=<uuid>). Passed through to
   *  releaseFlightAction so the backend runs the compliance gate; if
   *  the UI guard is bypassed the server still blocks the release. */
  pilotUserId?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!flight) {
    return (
      <button
        type="button"
        disabled
        title="Pick a scheduled flight above first"
        className={`${BUTTON_CLASS} cursor-not-allowed opacity-60`}
      >
        <PdfIcon />
        Generate PDF
      </button>
    );
  }

  // Hard block takes precedence over released/scheduled state.
  // The rule from Spec 5: a hard-blocked PIC cannot be released even
  // if the flight was previously released (a downstream reopen +
  // re-release would need to clear the block).
  if (hardBlockReason) {
    return (
      <button
        type="button"
        disabled
        title={hardBlockReason}
        className={`${BUTTON_CLASS} cursor-not-allowed border border-status-red/40 bg-status-red/10 text-status-red opacity-90 hover:bg-status-red/10`}
      >
        <PdfIcon />
        Generate PDF — blocked
      </button>
    );
  }

  const pdfUrl = `/api/dispatch/${flight.id}/release.pdf`;

  // Already released — straight download link.
  if (flight.status === "released") {
    return (
      <a
        href={pdfUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={`Download the release PDF for ${flight.flight_number}`}
        className={`${BUTTON_CLASS} hover:bg-primary/90`}
      >
        <PdfIcon />
        Generate PDF
      </a>
    );
  }

  // Scheduled — must release first. The backend rejects PDF generation for
  // un-released flights (services/ops/app/routes/flights.py: "flight_not
  // _released_yet"), and release is irreversible, so prompt before doing it.
  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await releaseFlightAction(flight.id, pilotUserId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Open the PDF in a new tab so the user keeps their place on /dispatch/.
      window.open(pdfUrl, "_blank", "noopener,noreferrer");
      setOpen(false);
      // Refresh the server-rendered page so the SelectedFlightSummary +
      // FlightDetails inputs reflect the new "released" status.
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Release ${flight.flight_number} and download the dispatch PDF`}
        className={`${BUTTON_CLASS} hover:bg-primary/90`}
      >
        <PdfIcon />
        Generate PDF
      </button>

      <Dialog open={open} onOpenChange={(o) => !isPending && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Release {flight.flight_number} and generate PDF?
            </DialogTitle>
            <DialogDescription>
              The backend only renders a dispatch PDF for released flights, so
              clicking continue locks{" "}
              <span className="font-mono">
                {flight.origin} → {flight.destination}
              </span>{" "}
              as released and then opens the PDF in a new tab. Release is
              recorded in the audit log and cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={isPending}
              className="inline-flex h-9 items-center rounded-md border border-border bg-transparent px-4 text-sm font-medium hover:bg-muted disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isPending}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {isPending ? "Releasing…" : "Release & generate"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
