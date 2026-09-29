"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

import { releaseFlightAction } from "@/app/(app)/dispatch/[flightId]/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ReleaseButtonProps {
  flightId: string;
  flightNumber: string;
  /** Every airport on the route, for the confirmation. */
  stops: string[];
  /** The packet's release gate. When set the button is disabled; the
   *  row shows the reason beside it. */
  hardBlockReason?: string | null;
  /** M2-M-5 — currently-selected PIC, so the server compliance gate
   *  runs against the pilot the dispatcher is actually releasing. */
  pilotUserId?: string | null;
  /** M2-G-5 tail — supervisor override already recorded. */
  overridesAcknowledged?: boolean;
  /** Routed ICAOs the dispatcher ticked in the NOTAM panel. The backend
   *  refuses the release unless every routed stop is present, so
   *  omitting these makes the button fail every time. */
  notamAckedIcaos?: string[];
  /** Dispatcher acknowledged stale / missing route weather. */
  staleWeatherAcknowledged?: boolean;
  /** `?warns_acked=` — the currency warnings the dispatcher ticked. */
  acknowledgedWarnings?: string[];
}

/**
 * "Release dispatch" — the release path on a scheduled flight.
 *
 * Every argument below has to be forwarded. This button used to call
 * `releaseFlightAction(flightId)` and nothing else, which meant the
 * action's `notamAckedIcaos ?? []` sent an empty list on every press.
 * The backend then refused with `notam_ack_required` naming every stop
 * on the route — so a dispatcher could tick all the boxes, see
 * "2/2 acknowledged", press Release, and be told the NOTAMs were not
 * acknowledged. There was no way through it from this button at all.
 *
 * GeneratePdfButton, the other release path in the same column, always
 * passed all five. Same server action, same flight, one worked.
 */
export function ReleaseButton({
  flightId,
  flightNumber,
  stops,
  hardBlockReason = null,
  pilotUserId = null,
  overridesAcknowledged = false,
  notamAckedIcaos = [],
  staleWeatherAcknowledged = false,
  acknowledgedWarnings = [],
}: ReleaseButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleRelease = () => {
    setError(null);
    startTransition(async () => {
      const result = await releaseFlightAction(
        flightId,
        pilotUserId,
        overridesAcknowledged,
        staleWeatherAcknowledged,
        notamAckedIcaos,
        acknowledgedWarnings,
      );
      if (result.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        disabled={hardBlockReason !== null}
        title={hardBlockReason ?? undefined}
        aria-describedby={hardBlockReason ? "release-blocked-reason" : undefined}
      >
        <Send className="h-4 w-4" />
        {hardBlockReason ? "Release — blocked" : "Release dispatch"}
      </Button>

      <Dialog open={open} onOpenChange={(o) => !isPending && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Release {flightNumber}?</DialogTitle>
            <DialogDescription>
              Locks the flight plan for{" "}
              <span className="font-mono">{stops.join(" → ")}</span>{" "}
              and marks it as released. This action is recorded in the audit log
              and cannot be undone.
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
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleRelease} disabled={isPending}>
              {isPending ? "Releasing…" : "Release"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
