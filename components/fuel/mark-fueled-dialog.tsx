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
  fueledOrderAction,
  type FuelOrderActionState,
} from "@/app/(app)/fuel/orders/[id]/actions";

export function MarkFueledDialog({
  orderId,
  requestedGallons,
}: {
  orderId: string;
  requestedGallons: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<
    FuelOrderActionState,
    FormData
  >(fueledOrderAction, { status: "idle" });

  useEffect(() => {
    if (state.status === "ok") setOpen(false);
  }, [state.status]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-status-green/40 bg-status-green/10 px-3 py-1.5 text-xs font-semibold text-status-green hover:bg-status-green/20"
      >
        ⛽ Mark fueled
      </button>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Mark order fueled</DialogTitle>
            <DialogDescription>
              Actuals diverging from requested by more than 5% flip the order
              to <span className="font-semibold">discrepancy</span>. A
              discrepancy note also forces that branch.
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
                htmlFor="fueled_by_name"
                className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
              >
                Fueled by <span className="text-status-red">*</span>
              </label>
              <input
                id="fueled_by_name"
                name="fueled_by_name"
                required
                placeholder="Ramp agent or supplier"
                maxLength={200}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-green focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="actual_quantity_gallons"
                className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
              >
                Actual gallons <span className="text-status-red">*</span>
              </label>
              <input
                id="actual_quantity_gallons"
                name="actual_quantity_gallons"
                type="number"
                step="0.1"
                min={0}
                defaultValue={requestedGallons}
                required
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-green focus:outline-none"
              />
              <p className="mt-1 text-[0.65rem] text-muted-foreground/70">
                Requested {requestedGallons.toLocaleString()} gal.
              </p>
            </div>

            <div>
              <label
                htmlFor="closed_by_source"
                className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
              >
                Closed by
              </label>
              <select
                id="closed_by_source"
                name="closed_by_source"
                defaultValue="ramp"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-green focus:outline-none"
              >
                <option value="ramp">Ramp</option>
                <option value="supplier">Supplier</option>
                <option value="dispatch">Dispatch</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="discrepancy_reason"
                className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
              >
                Discrepancy reason (forces discrepancy state)
              </label>
              <textarea
                id="discrepancy_reason"
                name="discrepancy_reason"
                rows={3}
                maxLength={2000}
                placeholder="Quality flag, short delivery, etc."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-yellow focus:outline-none"
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
                className="inline-flex items-center gap-1.5 rounded-md bg-status-green px-4 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
              >
                {pending && <Spinner size="xs" />}
                {pending ? "Submitting…" : "Mark fueled"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
