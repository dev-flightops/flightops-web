"use client";

import { useActionState, useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

import {
  cancelOrderAction,
  type FuelOrderActionState,
} from "@/app/(app)/fuel/orders/[id]/actions";

export function CancelOrderDialog({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<
    FuelOrderActionState,
    FormData
  >(cancelOrderAction, { status: "idle" });

  useEffect(() => {
    if (state.status === "ok") setOpen(false);
  }, [state.status]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-1.5 text-xs font-semibold text-status-red hover:bg-status-red/20"
      >
        Cancel order
      </button>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Cancel fuel order</DialogTitle>
            <DialogDescription>
              Only open orders cancel (ordered or confirmed). Provide a
              reason for the audit trail.
            </DialogDescription>
          </DialogHeader>

          <form action={action} className="space-y-4">
            <input type="hidden" name="order_id" value={orderId} />

            {state.status === "api-error" && (
              <div
                role="alert"
                className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
              >
                {state.message}
              </div>
            )}

            <div>
              <label
                htmlFor="cancel_reason"
                className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
              >
                Reason <span className="text-status-red">*</span>
              </label>
              <textarea
                id="cancel_reason"
                name="cancel_reason"
                required
                rows={4}
                maxLength={2000}
                placeholder="Aircraft swap, customer no-show, weather, etc."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-red focus:outline-none"
              />
            </div>

            <DialogFooter>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/40"
              >
                Keep order
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-md bg-status-red px-4 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
              >
                {pending && <Spinner size="xs" />}
                {pending ? "Cancelling…" : "Cancel order"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
