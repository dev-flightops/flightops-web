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
  completeMaintenanceAction,
  type EquipmentActionState,
} from "@/app/(app)/equipment/[id]/actions";

function todayLocalIsoDate(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

export function CompleteMaintenanceButton({
  unitId,
  mxId,
  mxTitle,
  unitHours,
}: {
  unitId: string;
  mxId: string;
  mxTitle: string;
  unitHours: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<
    EquipmentActionState,
    FormData
  >(completeMaintenanceAction, { status: "idle" });

  useEffect(() => {
    if (state.status === "ok") setOpen(false);
  }, [state.status]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-status-green/40 bg-status-green/10 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-status-green hover:bg-status-green/20"
      >
        Complete
      </button>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Mark MX complete</DialogTitle>
            <DialogDescription>
              <span className="font-semibold">{mxTitle}</span>
            </DialogDescription>
          </DialogHeader>

          <form action={action} className="space-y-4">
            <input type="hidden" name="unit_id" value={unitId} />
            <input type="hidden" name="mx_id" value={mxId} />

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
                htmlFor="completed_date"
                className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
              >
                Completed on <span className="text-status-red">*</span>
              </label>
              <input
                id="completed_date"
                name="completed_date"
                type="date"
                required
                defaultValue={todayLocalIsoDate()}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-green focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="completed_hours"
                className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
              >
                Hours at completion (optional)
              </label>
              <input
                id="completed_hours"
                name="completed_hours"
                type="number"
                step="0.1"
                min={0}
                defaultValue={unitHours.toFixed(1)}
                placeholder={unitHours.toString()}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-green focus:outline-none"
              />
              <p className="mt-1 text-[0.65rem] text-muted-foreground/70">
                Defaults to current unit hours. Recurring items use this to
                recompute the next due hours.
              </p>
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
                {pending ? "Completing…" : "Mark complete"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
