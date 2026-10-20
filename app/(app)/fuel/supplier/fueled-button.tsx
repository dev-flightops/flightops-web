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
        className="btn-caps rounded-md border border-primary/40 bg-background px-3 py-1 text-primary hover:bg-primary/5 text-[0.68rem]"
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
        <span className="eyebrow">
          Your name *
        </span>
        <input
          type="text"
          value={name}
          maxLength={200}
          disabled={pending}
          onChange={(e) => setName(e.target.value)}
          className="ff-input mt-0.5 px-2 py-1 text-xs"
          placeholder="e.g. Sarah at AvFuel"
        />
      </label>
      <label className="block">
        <span className="eyebrow">
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
          className="ff-input mt-0.5 px-2 py-1 text-xs"
          placeholder={String(requestedGallons)}
        />
        <span className="text-[0.6rem] text-muted-foreground">
          Off by &gt;5% from {requestedGallons} auto-flags as discrepancy.
        </span>
      </label>
      <label className="block">
        <span className="eyebrow">
          Discrepancy note (optional)
        </span>
        <input
          type="text"
          value={reason}
          maxLength={2000}
          disabled={pending}
          onChange={(e) => setReason(e.target.value)}
          className="ff-input mt-0.5 px-2 py-1 text-xs"
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
          className="btn-caps inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-white hover:bg-brand-dark disabled:opacity-50 text-[0.68rem]"
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
          className="btn-caps rounded-md border border-input px-2.5 py-1 text-foreground hover:bg-accent disabled:opacity-50 text-[0.68rem]"
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
