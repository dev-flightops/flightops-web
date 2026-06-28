"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Spinner } from "@/components/ui/spinner";

import { acknowledgeOrderAction } from "./acknowledge-action";

/**
 * Inline acknowledge control on each "ordered" row in the supplier
 * inbox. First click expands an inline panel with name + note inputs;
 * Confirm submits the server action, Cancel collapses without firing.
 */
export function AcknowledgeButton({
  orderId,
  tail,
}: {
  orderId: string;
  tail: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
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
        className="rounded-md border border-status-green/40 bg-status-green/10 px-3 py-1 text-[0.65rem] font-semibold text-status-green hover:bg-status-green/20"
      >
        Acknowledge
      </button>
    );
  }

  return (
    <div className="space-y-1.5 rounded-md border border-border bg-card p-2 text-[0.65rem]">
      <div className="font-semibold text-foreground">
        Acknowledge order for{" "}
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
          Note (optional)
        </span>
        <input
          type="text"
          value={note}
          maxLength={500}
          disabled={pending}
          onChange={(e) => setNote(e.target.value)}
          className="mt-0.5 w-full rounded border border-border bg-background px-2 py-1 text-xs disabled:opacity-60"
          placeholder="e.g. Truck dispatched, ETA 30min"
        />
      </label>
      <div className="flex items-center gap-1.5 pt-1">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await acknowledgeOrderAction(orderId, name, note);
              if (result.status === "error") {
                setError(result.message);
                return;
              }
              setOpen(false);
              setName("");
              setNote("");
              router.refresh();
            });
          }}
          className="inline-flex items-center gap-1 rounded-md bg-status-green px-2.5 py-1 text-[0.65rem] font-semibold text-white hover:brightness-110 disabled:opacity-50"
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
            setNote("");
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
