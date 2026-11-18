"use client";

import Link from "next/link";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { buttonSolid, buttonOutline, linkCaps } from "@/components/ff/controls";
import { bagLine, type Bag } from "@/lib/bags";
import { bumpBagsAction } from "./actions";

/**
 * Take bags off the manifest to the waiting list for a later flight. With
 * the passenger's bags listed one by one (the client, 18 Nov: "in case it
 * gets bumped or lost"), the ramp picks the bags, and what they look like
 * goes with them; otherwise it gives the weight and the pieces.
 */
export function BumpBags({
  flightId,
  paxId,
  name,
  baggageLbs,
  bags = [],
}: {
  flightId: string;
  paxId: string;
  name: string;
  baggageLbs: string;
  /** The passenger's bags aboard, when listed one by one. */
  bags?: Bag[];
}) {
  const listed = bags.length > 0;
  const [open, setOpen] = useState(false);
  const [weight, setWeight] = useState(baggageLbs);
  const [pieces, setPieces] = useState("1");
  const [chosen, setChosen] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moved, setMoved] = useState(false);

  function toggle(id: string, on: boolean) {
    setChosen((now) => (on ? [...now, id] : now.filter((other) => other !== id)));
  }

  return (
    <>
      <button
        type="button"
        className="text-xs font-semibold hover:underline"
        onClick={() => {
          setOpen(true);
          setMoved(false);
          setWeight(baggageLbs);
          setChosen([]);
          setError(null);
        }}
      >
        Bump bags
      </button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!pending) setOpen(value);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bump bags — {name}</DialogTitle>
            <DialogDescription>
              Take bags off this manifest and keep them in Mail &amp; Freight for the next flight. The passenger and
              booking remain linked to the waiting bags.
            </DialogDescription>
          </DialogHeader>
          {moved ? (
            <div role="status" className="space-y-3">
              <p>Bags moved to the waiting-load queue. The manifest’s baggage weight has been reduced.</p>
              <Link className={linkCaps} href="/manifest/waiting">
                Find the waiting bags
              </Link>
            </div>
          ) : (
            <form
              method="post"
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (listed && chosen.length === 0) {
                  setError("Choose the bags to bump.");
                  return;
                }
                setPending(true);
                setError(null);
                void (async () => {
                  try {
                    const result = await bumpBagsAction(
                      flightId,
                      paxId,
                      listed ? { bag_ids: chosen, reason } : { weight_lbs: weight, pieces: Number(pieces), reason },
                    );
                    if (result.ok) setMoved(true);
                    else setError(result.error ?? "Could not move the bags.");
                  } catch {
                    setError("Connection interrupted. Check the manifest and waiting list before retrying.");
                  } finally {
                    setPending(false);
                  }
                })();
              }}
            >
              {listed ? (
                <fieldset className="space-y-2" disabled={pending}>
                  <legend className="field-label">Bags to bump</legend>
                  {bags.map((bag) => (
                    <label key={bag.id} className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={chosen.includes(bag.id)}
                        onChange={(event) => toggle(bag.id, event.target.checked)}
                      />
                      <span>{bagLine(bag)}</span>
                    </label>
                  ))}
                </fieldset>
              ) : (
                <>
                  <label className="block">
                    Weight to bump (lb)
                    <input
                      className="field-input mt-1 w-full rounded border border-input bg-background p-2"
                      type="number"
                      min="0.1"
                      step="0.1"
                      max={baggageLbs}
                      required
                      disabled={pending}
                      value={weight}
                      onChange={(event) => setWeight(event.target.value)}
                    />
                  </label>
                  <label className="block">
                    Bag count
                    <input
                      className="mt-1 w-full rounded border border-input bg-background p-2"
                      type="number"
                      min="1"
                      max="1000"
                      step="1"
                      required
                      disabled={pending}
                      value={pieces}
                      onChange={(event) => setPieces(event.target.value)}
                    />
                  </label>
                </>
              )}
              <label className="block">
                Reason
                <textarea
                  className="mt-1 w-full rounded border border-input bg-background p-2"
                  required
                  maxLength={500}
                  disabled={pending}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
              {error && <p role="alert">{error}</p>}
              <div className="flex gap-3">
                <button type="submit" className={buttonSolid} disabled={pending}>
                  {pending ? "Moving bags…" : "Move bags to waiting list"}
                </button>
                <button type="button" className={buttonOutline} disabled={pending} onClick={() => setOpen(false)}>
                  Back
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
