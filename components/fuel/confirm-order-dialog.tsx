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
  confirmOrderAction,
  type FuelOrderActionState,
} from "@/app/(app)/fuel/orders/[id]/actions";

export function ConfirmOrderDialog({
  orderId,
  supplierName,
}: {
  orderId: string;
  supplierName: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<
    FuelOrderActionState,
    FormData
  >(confirmOrderAction, { status: "idle" });

  useEffect(() => {
    if (state.status === "ok") setOpen(false);
  }, [state.status]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-status-blue bg-status-blue/15 px-3 py-1.5 text-xs font-semibold text-status-blue hover:bg-status-blue/20"
      >
        ✓ Confirm
      </button>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Confirm order</DialogTitle>
            <DialogDescription>
              The supplier (<span className="font-semibold">{supplierName}</span>)
              has acknowledged this order.
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
                htmlFor="confirmed_by_name"
                className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
              >
                Confirmed by <span className="text-status-red">*</span>
              </label>
              <input
                id="confirmed_by_name"
                name="confirmed_by_name"
                required
                placeholder="Name of supplier rep"
                maxLength={200}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-blue focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="confirmed_note"
                className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
              >
                Note (optional)
              </label>
              <textarea
                id="confirmed_note"
                name="confirmed_note"
                rows={3}
                maxLength={2000}
                placeholder="ETA, ramp position, etc."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-blue focus:outline-none"
              />
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
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-md bg-status-blue px-4 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
              >
                {pending && <Spinner size="xs" />}
                {pending ? "Confirming…" : "Confirm order"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
