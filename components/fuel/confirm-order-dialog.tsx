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
        className="btn-caps rounded-md border border-primary/40 bg-background px-3 py-1.5 text-primary hover:bg-primary/5 text-[0.72rem]"
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
                className="notice notice-red"
              >
                {state.message}
              </div>
            )}

            <div>
              <label
                htmlFor="confirmed_by_name"
                className="field-label"
              >
                Confirmed by <span className="text-status-red">*</span>
              </label>
              <input
                id="confirmed_by_name"
                name="confirmed_by_name"
                required
                placeholder="Name of supplier rep"
                maxLength={200}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="confirmed_note"
                className="field-label"
              >
                Note (optional)
              </label>
              <textarea
                id="confirmed_note"
                name="confirmed_note"
                rows={3}
                maxLength={2000}
                placeholder="ETA, ramp position, etc."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <DialogFooter>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="btn-caps rounded-md border border-input px-3 py-2 text-foreground hover:bg-accent text-[0.72rem]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="btn-caps inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-white hover:bg-brand-dark disabled:opacity-60 text-[0.72rem]"
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
