"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import type { DepartureFlag } from "@/lib/api/types";

import {
  checkInFlightAction,
  departureCheckAction,
  type CheckInEvent,
} from "./check-in-action";

/**
 * Mark Departed / Mark Arrived on the flight board (M2-G-11b).
 *
 *   status=released AND no actual_departure_at  → "Mark Departed"
 *   status=released AND actual_departure_at set → "Mark Arrived"
 *   any other state                             → button hidden
 *
 * An in-app dialog asks first (#155: the browser's confirm() pop-up, which
 * some browsers and tablets block, left the button silently doing
 * nothing). Before a departure it shows what the departure will be
 * flagged for: the PIC off duty, the release not accepted, the FRAT not
 * signed, no locked manifest, more than an hour early. The departure is
 * recorded anyway, since the aircraft has left and flight following has
 * to track it; the flags go to the Chief Pilot and DO and onto Data
 * Integrity.
 */
export function CheckInButton({
  flightId,
  flightNumber,
  event,
}: {
  flightId: string;
  flightNumber?: string;
  event: CheckInEvent;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [flags, setFlags] = useState<DepartureFlag[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const label = event === "depart" ? "Mark Departed" : "Mark Arrived";

  const begin = async () => {
    setError(null);
    setFlags(null);
    setOpen(true);
    if (event === "depart") {
      setLoading(true);
      setFlags(await departureCheckAction(flightId));
      setLoading(false);
    }
  };

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await checkInFlightAction(flightId, event, true);
      if (result.ok) {
        setOpen(false);
        router.refresh();
        return;
      }
      setError(result.error);
      if (result.flags) setFlags(result.flags);
    });
  };

  const flagged = (flags ?? []).length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => void begin()}
        disabled={pending}
        className="mr-4 inline-flex items-center gap-1 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-status-green underline-offset-4 hover:underline disabled:opacity-50"
      >
        {pending && <Spinner size="xs" />}
        {pending ? "Saving…" : label}
      </button>
      <Dialog open={open} onOpenChange={(next) => (pending ? null : setOpen(next))}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {label}
              {flightNumber ? ` · ${flightNumber}` : ""}
            </DialogTitle>
            <DialogDescription>
              {event === "depart"
                ? "Records the departure now."
                : "Records the arrival now and closes the flight as completed. The block time goes onto the aircraft's hours and a draft flight log opens for the PIC."}
            </DialogDescription>
          </DialogHeader>
          {event === "depart" ? (
            loading ? (
              <p className="text-sm text-muted-foreground">Checking the flight…</p>
            ) : flagged ? (
              <div role="alert" className="notice notice-yellow text-sm">
                <p className="notice-label">It will be recorded with these flags</p>
                <ul className="mt-1 list-disc pl-5 text-foreground">
                  {(flags ?? []).map((f) => (
                    <li key={f.code}>{f.message}</li>
                  ))}
                </ul>
                <p className="mt-1 text-muted-foreground">
                  The Chief Pilot and the DO are alerted, and Data Integrity lists the flight.
                </p>
              </div>
            ) : flags === null ? (
              <p className="text-sm text-muted-foreground">
                The flight couldn&apos;t be checked just now; anything wrong is still flagged when it is recorded.
              </p>
            ) : (
              <p className="text-sm text-foreground">Nothing to flag: the PIC is on duty, the release accepted, the FRAT signed and the manifest locked.</p>
            )
          ) : null}
          {error ? (
            <p role="alert" className="notice notice-red text-sm">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Back
            </Button>
            <Button type="button" onClick={confirm} disabled={pending || loading}>
              {pending ? "Saving…" : flagged ? "Record it, flagged" : label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
