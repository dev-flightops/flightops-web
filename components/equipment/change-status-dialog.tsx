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
import type { GSEUnitStatus } from "@/lib/api/types";

import {
  changeStatusAction,
  type EquipmentActionState,
} from "@/app/(app)/equipment/[id]/actions";

const STATUSES = [
  {
    value: "operational",
    label: "Operational",
    note: "Ready for service.",
  },
  {
    value: "maintenance",
    label: "In maintenance",
    note: "Scheduled or active service.",
  },
  {
    value: "out_of_service",
    label: "Out of service",
    note: "Unit cannot be used until repaired.",
  },
] as const;

export function ChangeStatusDialog({
  unitId,
  currentStatus,
}: {
  unitId: string;
  currentStatus: GSEUnitStatus;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<
    EquipmentActionState,
    FormData
  >(changeStatusAction, { status: "idle" });

  useEffect(() => {
    if (state.status === "ok") setOpen(false);
  }, [state.status]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/40"
      >
        Change status
      </button>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Change equipment status</DialogTitle>
            <DialogDescription>
              Required when a unit goes into maintenance or out of service —
              the note surfaces on the unit's card.
            </DialogDescription>
          </DialogHeader>

          <form action={action} className="space-y-4">
            <input type="hidden" name="unit_id" value={unitId} />

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
                htmlFor="status"
                className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
              >
                New status <span className="text-status-red">*</span>
              </label>
              <select
                id="status"
                name="status"
                defaultValue={currentStatus}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-blue focus:outline-none"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label} — {s.note}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="status_note"
                className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
              >
                Note (optional — recommended for maintenance / out-of-service)
              </label>
              <textarea
                id="status_note"
                name="status_note"
                rows={3}
                placeholder="e.g. hydraulic pump failure; parts on order"
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
                {pending ? "Updating…" : "Update status"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
