"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  cancelReleasedFlightAction,
  pullBackReleaseAction,
} from "@/app/(app)/dispatch/[flightId]/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Mode = "pull-back" | "cancel";

const MIN_REASON = 5;

const COPY: Record<Mode, { title: string; body: string; confirm: string }> = {
  "pull-back": {
    title: "Pull back the release",
    body:
      "The flight goes back to scheduled. It needs a new release, with fresh " +
      "acknowledgments, and the pilot reviews and accepts it again. Say why: " +
      "it goes in the flight's record with the release it takes back.",
    confirm: "Pull back release",
  },
  cancel: {
    title: "Cancel the released flight",
    body:
      "The flight is cancelled and its mail goes back on the waiting list. " +
      "Say why: it goes in the flight's record with the release it undoes.",
    confirm: "Cancel flight",
  },
};

/**
 * Take a release back, or cancel the flight, before it departs (#90).
 *
 * Until #90 a released flight could be neither: when the weather, the
 * crew or the aircraft changed after the release, the dispatcher had no
 * way to stop it in the system. Both need a reason, kept with the
 * release in the flight's audit trail.
 */
export function WithdrawRelease({
  flightId,
  flightNumber,
}: {
  flightId: string;
  flightNumber: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    if (pending) return;
    setMode(null);
    setReason("");
    setError(null);
  }

  function confirm() {
    if (!mode) return;
    setError(null);
    startTransition(async () => {
      const act = mode === "pull-back" ? pullBackReleaseAction : cancelReleasedFlightAction;
      const result = await act(flightId, reason.trim());
      if (result.ok) {
        setMode(null);
        setReason("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  const copy = mode ? COPY[mode] : null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setMode("pull-back")}>
          Pull back release
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setMode("cancel")}>
          Cancel flight
        </Button>
      </div>

      <Dialog open={mode !== null} onOpenChange={(open) => (open ? null : close())}>
        <DialogContent className="sm:max-w-lg">
          {copy && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {copy.title} · {flightNumber}
                </DialogTitle>
                <DialogDescription>{copy.body}</DialogDescription>
              </DialogHeader>
              <label htmlFor="withdraw-reason" className="field-label">
                Reason
              </label>
              <textarea
                id="withdraw-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                placeholder="e.g. PABE went below minimums after the release"
                className="flex w-full rounded-lg border border-border bg-background px-3 py-2 text-[0.8125rem] focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
              />
              {error && (
                <p role="alert" className="notice notice-red">
                  {error}
                </p>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={close} disabled={pending}>
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={confirm}
                  disabled={pending || reason.trim().length < MIN_REASON}
                >
                  {pending ? "Saving…" : copy.confirm}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
