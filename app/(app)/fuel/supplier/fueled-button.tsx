"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Spinner } from "@/components/ui/spinner";

import { markFueledAction } from "./fueled-action";

/**
 * Inline "Mark Fueled" control on each `confirmed` row of the
 * supplier inbox. Pilots can also report fueled status from the ramp
 * side; this gives the supplier the same surface so a fully self-
 * service delivery doesn't need a ramp roundtrip.
 *
 * Backend auto-flips to `discrepancy` when actuals diverge from
 * requested by > 5% — even without a typed reason. The success
 * toast reflects which terminal status the backend chose so the
 * supplier knows when their entry produced a discrepancy.
 */
export function MarkFueledButton({
  orderId,
  tail,
  requestedGallons,
}: {
  orderId: string;
  tail: string;
  requestedGallons: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [gallons, setGallons] = useState(String(requestedGallons));
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="rounded-md border border-status-blue/40 bg-status-blue/10 px-3 py-1 text-[0.65rem] font-semibold text-status-blue hover:bg-status-blue/20"
      >
        Mark Fueled
      </button>
    );
  }

  return (
    <div className="space-y-1.5 rounded-md border border-border bg-card p-2 text-[0.65rem]">
      <div className="font-semibold text-foreground">
        Mark fueled for{" "}
        <span className="font-mono">{tail}</span>
      </div>
      <label className="block">
        <span className="text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Your name *
        </span>
        <input
          type="text"
          value={name}
          maxLength={200}
          disabled={pending}
          onChange={(e) => setName(e.target.value)}
          className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1 text-xs disabled:opacity-60"
          placeholder="e.g. Sarah at AvFuel"
        />
      </label>
      <label className="block">
        <span className="text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Actual gallons *
        </span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step={0.1}
          value={gallons}
          disabled={pending}
          onChange={(e) => setGallons(e.target.value)}
          className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1 text-xs disabled:opacity-60"
          placeholder={String(requestedGallons)}
        />
        <span className="text-[0.6rem] text-muted-foreground">
          Off by &gt;5% from {requestedGallons} auto-flags as discrepancy.
        </span>
      </label>
      <label className="block">
        <span className="text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Discrepancy note (optional)
        </span>
        <input
          type="text"
          value={reason}
          maxLength={2000}
          disabled={pending}
          onChange={(e) => setReason(e.target.value)}
          className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1 text-xs disabled:opacity-60"
          placeholder="e.g. Off-spec grade, contamination"
        />
      </label>
      <div className="flex items-center gap-1.5 pt-1">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await markFueledAction(
                orderId,
                name,
                gallons,
                reason,
              );
              if (result.status === "error") {
                setError(result.message);
                return;
              }
              setOpen(false);
              setName("");
              setReason("");
              router.refresh();
            });
          }}
          className="inline-flex items-center gap-1 rounded-md bg-status-blue px-2.5 py-1 text-[0.65rem] font-semibold text-white hover:brightness-110 disabled:opacity-50"
        >
          {pending && <Spinner size="xs" />}
          Confirm
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setName("");
            setReason("");
            setError(null);
          }}
          className="rounded-md border border-border bg-background px-2.5 py-1 text-[0.65rem] font-semibold text-foreground hover:bg-muted disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="text-status-red">
          {error}
        </p>
      )}
    </div>
  );
}
