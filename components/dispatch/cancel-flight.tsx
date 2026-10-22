"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { cancelScheduledFlightAction } from "@/app/(app)/dispatch/[flightId]/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Cancel a scheduled flight from its packet (#106).
 *
 * The client, 22 Oct: "Is there a way to ... delete a flight if it's not
 * needed?" A released flight could be cancelled since #90, a scheduled
 * one only from End of Day. Cancelling, not deleting, as on legacy's
 * fleet board: the flight leaves the board and stays on record.
 */
export function CancelFlight({
  flightId,
  flightNumber,
}: {
  flightId: string;
  flightNumber: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    if (pending) return;
    setOpen(false);
    setReason("");
    setError(null);
  }

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await cancelScheduledFlightAction(flightId, reason);
      if (result.ok) {
        setOpen(false);
        setReason("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Cancel Flight
      </Button>
      <Dialog open={open} onOpenChange={(next) => (next ? null : close())}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cancel {flightNumber}</DialogTitle>
            <DialogDescription>
              The flight leaves the board and stays on record as cancelled. Any mail or
              freight it took from the waiting list goes back on it.
            </DialogDescription>
          </DialogHeader>
          <label htmlFor="cancel-reason" className="field-label">
            Reason (optional)
          </label>
          <textarea
            id="cancel-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            placeholder="e.g. Planned twice; GV1112 flies this route"
            className="flex w-full rounded-lg border border-border bg-background px-3 py-2 text-[0.8125rem] focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
          />
          {error ? (
            <p role="alert" className="notice notice-red">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={pending}>
              Back
            </Button>
            <Button type="button" onClick={confirm} disabled={pending}>
              {pending ? "Cancelling…" : "Cancel Flight"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
