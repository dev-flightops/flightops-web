"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import type { ComplianceFinding } from "@/lib/api/types";

import {
  createOverridesAction,
  type CreateOverridesResult,
} from "./override-actions";

/**
 * M2-G-5 tail — supervisor override modal for the hard-block banner.
 *
 * Spec 5 §"Hard blocks": "Supervisor override requires name + cert #
 * + ≥50-char reason; logged to currency_overrides." The supervisor's
 * name comes from the JWT (the caller); the modal collects the cert
 * number + reason. Same cert + reason applied to every listed hard-
 * block item — one override conversation, N items covered.
 *
 * On success:
 *   1. currency_overrides rows exist (audit trail).
 *   2. We flip ?overrides_ack=1 in the URL so the page re-render
 *      knows the hard-block was overridden — the parent page uses
 *      this to enable Generate PDF and pass overrides_acknowledged
 *      to the release action.
 *
 * We DO NOT release the flight from here; the dispatcher clicks
 * Generate PDF separately. Keeps a small pause between "supervisor
 * signed off" and "flight actually released" so no double-clicks
 * ship a release the supervisor hadn't finished blessing.
 */
export function OverrideDialog({
  pilotUserId,
  pilotName,
  hardBlocks,
  flightId,
}: {
  pilotUserId: string;
  pilotName: string;
  hardBlocks: ComplianceFinding[];
  flightId: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [cert, setCert] = useState("");
  const [reason, setReason] = useState("");
  const [state, setState] = useState<CreateOverridesResult>({
    status: "ok",
    count: 0,
  });
  const [pending, startTransition] = useTransition();

  function fieldError(key: string): string | undefined {
    if (state.status !== "field-errors") return undefined;
    return state.errors[key];
  }
  const apiError = state.status === "api-error" ? state.message : null;

  function submit() {
    setState({ status: "ok", count: 0 }); // reset before submit
    startTransition(async () => {
      const result = await createOverridesAction(
        pilotUserId,
        hardBlocks.map((b) => b.currency_item_id),
        cert,
        reason,
        flightId,
      );
      if (result.status === "ok") {
        // Flip the URL flag so the page-level loader knows the
        // hard-block was overridden and the release action can send
        // overrides_acknowledged=true.
        const params = new URLSearchParams(searchParams.toString());
        params.set("overrides_ack", "1");
        router.push(`/dispatch/?${params.toString()}`);
        setOpen(false);
        setCert("");
        setReason("");
        return;
      }
      setState(result);
    });
  }

  const reasonLen = reason.trim().length;
  const remaining = Math.max(0, 50 - reasonLen);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 rounded-md border border-status-red bg-status-red/20 px-3 py-1.5 text-[0.7rem] font-semibold text-status-red hover:bg-status-red/30"
      >
        Supervisor Override…
      </button>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>Override hard-block for {pilotName}</DialogTitle>
            <DialogDescription>
              Recording one override per item below. Same cert + reason
              apply to all. Audit-logged permanently (Spec 5); CP + DO
              are notified.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {apiError && (
              <div
                role="alert"
                className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
              >
                {apiError}
              </div>
            )}

            <ul className="rounded-md border border-border bg-card/60 p-2 text-[0.7rem]">
              {hardBlocks.map((b) => (
                <li
                  key={b.currency_item_id}
                  className="flex items-baseline gap-2 py-0.5"
                >
                  <span className="text-status-red">●</span>
                  <span className="font-semibold text-foreground">
                    {b.name}
                  </span>
                  <span className="text-muted-foreground">
                    ({b.regulation})
                  </span>
                </li>
              ))}
            </ul>

            <div>
              <label
                htmlFor="supervisor_cert_number"
                className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
              >
                Supervisor cert number <span className="text-status-red">*</span>
              </label>
              <input
                id="supervisor_cert_number"
                type="text"
                value={cert}
                maxLength={64}
                disabled={pending}
                onChange={(e) => setCert(e.target.value)}
                placeholder="CFI-123456"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-blue focus:outline-none aria-[invalid=true]:border-status-red"
                aria-invalid={fieldError("supervisor_cert_number") ? "true" : undefined}
              />
              {fieldError("supervisor_cert_number") && (
                <p role="alert" className="mt-1 text-[0.65rem] text-status-red">
                  {fieldError("supervisor_cert_number")}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="reason"
                className="mb-1 flex items-baseline justify-between gap-2 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
              >
                <span>
                  Reason <span className="text-status-red">*</span>
                </span>
                <span
                  className={
                    "font-mono " +
                    (remaining === 0
                      ? "text-status-green"
                      : "text-status-yellow")
                  }
                >
                  {remaining === 0
                    ? `${reasonLen} chars`
                    : `${remaining} more needed`}
                </span>
              </label>
              <textarea
                id="reason"
                rows={4}
                maxLength={4000}
                value={reason}
                disabled={pending}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why does this pilot need to fly despite the block? Spec 5 requires at least 50 characters of context."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-blue focus:outline-none aria-[invalid=true]:border-status-red"
                aria-invalid={fieldError("reason") ? "true" : undefined}
              />
              {fieldError("reason") && (
                <p role="alert" className="mt-1 text-[0.65rem] text-status-red">
                  {fieldError("reason")}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-md bg-status-red px-4 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
            >
              {pending && <Spinner size="xs" />}
              {pending
                ? "Recording…"
                : `Record override${hardBlocks.length > 1 ? `s (${hardBlocks.length})` : ""}`}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
