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
  resolveSquawkAction,
  type EquipmentActionState,
} from "@/app/(app)/equipment/[id]/actions";

export function ResolveSquawkButton({
  unitId,
  squawkId,
  squawkSummary,
}: {
  unitId: string;
  squawkId: string;
  squawkSummary: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<
    EquipmentActionState,
    FormData
  >(resolveSquawkAction, { status: "idle" });

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
        Resolve
      </button>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Resolve squawk</DialogTitle>
            <DialogDescription>{squawkSummary}</DialogDescription>
          </DialogHeader>

          <form action={action} className="space-y-4">
            <input type="hidden" name="unit_id" value={unitId} />
            <input type="hidden" name="squawk_id" value={squawkId} />

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
                htmlFor="resolution_notes"
                className="field-label"
              >
                Resolution notes <span className="text-status-red">*</span>
              </label>
              <textarea
                id="resolution_notes"
                name="resolution_notes"
                required
                rows={4}
                placeholder="What was done to clear this discrepancy?"
                className="ff-input px-3 py-2 text-sm focus:border-status-green"
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
                className="btn-caps inline-flex items-center gap-1.5 rounded-md bg-status-green-fill px-4 py-2 text-white hover:brightness-95 disabled:opacity-60 text-[0.72rem]"
              >
                {pending && <Spinner size="xs" />}
                {pending ? "Resolving…" : "Mark resolved"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
