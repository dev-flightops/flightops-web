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
  DEFAULT_TIME_ZONE,
  localToUtcIso,
  utcToLocalInput,
  zoneAbbreviation,
  zuluHint,
} from "@/lib/format/local-time";

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
 *
 * A multi-stop flight is marked at each stop (LOG-14; Greg, 13 Nov: "mark
 * those"): the button names the stop, and only the flight's first
 * departure is flagged. The time is now unless the dispatcher changes it,
 * so a stop caught late is marked when it happened rather than in a rush
 * of marks the five-minute rule would refuse.
 */
export function CheckInButton({
  flightId,
  flightNumber,
  event,
  leg = null,
  airport,
  first = true,
  last = true,
}: {
  flightId: string;
  flightNumber?: string;
  event: CheckInEvent;
  /** The leg this mark is for, on a multi-stop flight; null for a single leg. */
  leg?: number | null;
  /** The stop it leaves or lands at, named on a multi-stop flight. */
  airport?: string;
  /** Its departure from where it started: flagged (#155). */
  first?: boolean;
  /** Its landing at its destination: the flight completes. */
  last?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [flags, setFlags] = useState<DepartureFlag[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [when, setWhen] = useState("");
  const [edited, setEdited] = useState(false);

  const stop = leg !== null && airport ? ` ${airport}` : "";
  const label = `${event === "depart" ? "Mark Departed" : "Mark Arrived"}${stop}`;
  const flagsApply = event === "depart" && first;
  const zone = DEFAULT_TIME_ZONE;

  const begin = async () => {
    setError(null);
    setFlags(null);
    setWhen(utcToLocalInput(new Date().toISOString(), zone));
    setEdited(false);
    setOpen(true);
    if (flagsApply) {
      setLoading(true);
      setFlags(await departureCheckAction(flightId));
      setLoading(false);
    }
  };

  const confirm = () => {
    setError(null);
    const at = edited ? localToUtcIso(when, zone) : null;
    if (edited && !at) {
      setError("Enter the date and time it happened.");
      return;
    }
    startTransition(async () => {
      const result = await checkInFlightAction(flightId, event, true, { at, leg });
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
                ? first
                  ? "Records the departure now."
                  : `Records the departure from ${airport} now.`
                : last
                  ? "Records the arrival now and closes the flight as completed. The block time goes onto the aircraft's hours and a draft flight log opens for the PIC."
                  : `Records the landing at ${airport} now. The flight stays open until it lands at its destination.`}
            </DialogDescription>
          </DialogHeader>
          <div>
            <label htmlFor={`check-in-when-${flightId}`} className="field-label">
              When ({zoneAbbreviation(zone)}), if not now
            </label>
            <input
              id={`check-in-when-${flightId}`}
              type="datetime-local"
              value={when}
              onChange={(e) => {
                setWhen(e.target.value);
                setEdited(true);
              }}
              disabled={pending}
              className="ff-input px-3 py-2 font-mono text-sm"
            />
            <p className="mt-1 font-mono text-[0.65rem] text-muted-foreground">
              {edited ? zuluHint(when, zone) : "Now, unless you change it."}
            </p>
          </div>
          {flagsApply ? (
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
