"use client";

import Link from "next/link";
import { useState } from "react";

import { buttonOutline, buttonSolid, linkCaps } from "@/components/ff/controls";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { leaveBehindAction } from "./actions";

/**
 * The ramp couldn't fit it all (LOG-43, 10/24: "if they can't fit
 * everything on the plane they need to be able to tell the system they
 * had to bump x number of pounds from the flight"). The pounds left behind
 * come off this line and wait in Mail & Freight for the next flight; all of
 * it takes the line off the manifest.
 */
export function LeaveBehind({
  flightId,
  cargoId,
  description,
  weightLbs,
  pieces,
}: {
  flightId: string;
  cargoId: string;
  description: string;
  weightLbs: string;
  pieces: number;
}) {
  const [open, setOpen] = useState(false);
  const [weight, setWeight] = useState("");
  const [count, setCount] = useState("1");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  return (
    <>
      <button
        type="button"
        className="text-xs font-semibold text-foreground/80 hover:text-foreground hover:underline"
        onClick={() => {
          setOpen(true);
          setDone(false);
          setError(null);
          setWeight("");
          setCount("1");
          setReason("");
        }}
      >
        Leave behind<span className="sr-only"> part of {description}</span>
      </button>
      <Dialog open={open} onOpenChange={(value) => !pending && setOpen(value)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave behind — {description}</DialogTitle>
            <DialogDescription>
              {`${weightLbs} lb in ${pieces} ${pieces === 1 ? "piece" : "pieces"} on this flight. What doesn’t fit comes off the manifest and waits in Mail & Freight for the next flight.`}
            </DialogDescription>
          </DialogHeader>
          {done ? (
            <div role="status" className="space-y-3 text-sm">
              <p>It’s on the waiting list, and the manifest’s weight is down by the same.</p>
              <Link className={linkCaps} href="/manifest/waiting">
                Mail &amp; Freight waiting
              </Link>
            </div>
          ) : (
            <form
              method="post"
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                setPending(true);
                setError(null);
                void (async () => {
                  try {
                    const result = await leaveBehindAction(flightId, cargoId, {
                      weight_lbs: weight,
                      pieces: Number(count),
                      reason,
                    });
                    if (result.ok) setDone(true);
                    else setError(result.error ?? "Couldn't leave it behind.");
                  } catch {
                    setError("The connection dropped. Check the manifest and the waiting list before trying again.");
                  } finally {
                    setPending(false);
                  }
                })();
              }}
            >
              <label>
                <span className="field-label">Pounds left behind</span>
                <input
                  className="ff-input"
                  type="number"
                  min="0.1"
                  step="0.1"
                  max={weightLbs}
                  required
                  disabled={pending}
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
              </label>
              <label>
                <span className="field-label">Pieces left behind</span>
                <input
                  className="ff-input"
                  type="number"
                  min="1"
                  max={pieces}
                  step="1"
                  required
                  disabled={pending}
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                />
              </label>
              <label className="sm:col-span-2">
                <span className="field-label">Why</span>
                <textarea
                  className="ff-input"
                  rows={2}
                  required
                  maxLength={500}
                  disabled={pending}
                  placeholder="No room behind the seats"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              {error ? (
                <p role="alert" className="field-error sm:col-span-2">
                  {error}
                </p>
              ) : null}
              <div className="flex justify-end gap-2 sm:col-span-2">
                <button type="button" className={buttonOutline} disabled={pending} onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className={buttonSolid} disabled={pending}>
                  {pending ? "Saving…" : "Leave it behind"}
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
