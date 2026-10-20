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
        className="btn-caps rounded-md border px-2.5 py-1 border-status-green/60 text-[0.72rem] text-status-green hover:border-status-green"
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
                className="notice notice-red"
              >
                {state.message}
              </div>
            )}

            <div>
              <label
                htmlFor="completed_date"
                className="field-label"
              >
                Completed on <span className="text-status-red">*</span>
              </label>
              <input
                id="completed_date"
                name="completed_date"
                type="date"
                required
                defaultValue={todayLocalIsoDate()}
                className="ff-input px-3 py-2 text-sm focus:border-status-green"
              />
            </div>

            <div>
              <label
                htmlFor="completed_hours"
                className="field-label"
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
                className="ff-input px-3 py-2 text-sm focus:border-status-green"
              />
              <p className="mt-1 text-[0.65rem] text-muted-foreground">
                Defaults to current unit hours. Recurring items use this to
                recompute the next due hours.
              </p>
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
                className="btn-caps inline-flex items-center gap-1.5 rounded-md bg-status-green-fill px-4 py-2 text-white hover:brightness-95 disabled:opacity-60 text-[0.72rem]"
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
