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
        className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-1.5 text-xs font-semibold text-status-red hover:bg-status-red/15"
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
                className="notice notice-red"
              >
                {state.message}
              </div>
            )}

            <div>
              <label
                htmlFor="cancel_reason"
                className="field-label"
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
                className="btn-caps rounded-md border border-input px-3 py-2 text-foreground hover:bg-accent text-[0.72rem]"
              >
                Keep order
              </button>
              <button
                type="submit"
                disabled={pending}
                className="btn-caps inline-flex items-center gap-1.5 rounded-md bg-status-red-fill px-4 py-2 text-white hover:brightness-95 disabled:opacity-60 text-[0.72rem]"
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
