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
  reportSquawkAction,
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

export function ReportSquawkDialog({ unitId }: { unitId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<
    EquipmentActionState,
    FormData
  >(reportSquawkAction, { status: "idle" });

  useEffect(() => {
    if (state.status === "ok") setOpen(false);
  }, [state.status]);

  const fieldError = (key: string) =>
    state.status === "field-errors" ? state.errors[key] : undefined;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-caps rounded-md border px-3 py-1.5 border-status-yellow/60 text-[0.72rem] text-status-yellow hover:border-status-yellow"
      >
        + Report squawk
      </button>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Report equipment squawk</DialogTitle>
            <DialogDescription>
              Describe the discrepancy. Open squawks raise the unit's
              squawk count on the Equipment page and the Ground Ops hub.
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
                htmlFor="description"
                className="field-label"
              >
                Description <span className="text-status-red">*</span>
              </label>
              <textarea
                id="description"
                name="description"
                required
                rows={4}
                placeholder="What's wrong with the unit?"
                aria-invalid={fieldError("description") ? "true" : undefined}
                className="ff-input px-3 py-2 text-sm focus:border-status-yellow aria-[invalid=true]:border-status-red"
              />
              {fieldError("description") && (
                <p className="field-error">
                  {fieldError("description")}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="reported_date"
                className="field-label"
              >
                Reported on <span className="text-status-red">*</span>
              </label>
              <input
                id="reported_date"
                name="reported_date"
                type="date"
                required
                defaultValue={todayLocalIsoDate()}
                className="ff-input px-3 py-2 text-sm focus:border-status-yellow"
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
                className="btn-caps inline-flex items-center gap-1.5 rounded-md bg-status-yellow-fill px-4 py-2 text-white hover:brightness-95 disabled:opacity-60 text-[0.72rem]"
              >
                {pending && <Spinner size="xs" />}
                {pending ? "Submitting…" : "Report squawk"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
