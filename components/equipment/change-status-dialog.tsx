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

/** A unit whose service date has come: back to operational records that
 *  service, as in legacy (#134). `next` is the date it moves to, when the
 *  unit has an interval. */
export interface ServiceDue {
  due: string;
  next: string | null;
}

export function ChangeStatusDialog({
  unitId,
  currentStatus,
  serviceDue = null,
}: {
  unitId: string;
  currentStatus: GSEUnitStatus;
  serviceDue?: ServiceDue | null;
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
        className="btn-caps rounded-md border border-input px-3 py-1.5 text-foreground hover:bg-accent text-[0.72rem]"
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
                className="notice notice-red"
              >
                {state.message}
              </div>
            )}

            <div>
              <label
                htmlFor="status"
                className="field-label"
              >
                New status <span className="text-status-red">*</span>
              </label>
              <select
                id="status"
                name="status"
                defaultValue={currentStatus}
                className="ff-input px-3 py-2 text-sm"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label} — {s.note}
                  </option>
                ))}
              </select>
              {serviceDue && (
                <p className="mt-2 text-sm text-foreground">
                  Its service was due {serviceDue.due}. Setting it to
                  Operational records today&apos;s service
                  {serviceDue.next ? `; the next one is due ${serviceDue.next}.` : "."}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="status_note"
                className="field-label"
              >
                Note (optional — recommended for maintenance / out-of-service)
              </label>
              <textarea
                id="status_note"
                name="status_note"
                rows={3}
                placeholder="e.g. hydraulic pump failure; parts on order"
                className="ff-input px-3 py-2 text-sm"
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
                {pending ? "Updating…" : "Update status"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
