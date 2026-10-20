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
        className="rounded-md border border-status-yellow bg-status-yellow/15 px-3 py-1.5 text-xs font-semibold text-status-yellow hover:bg-status-yellow/15"
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
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-yellow focus:outline-none aria-[invalid=true]:border-status-red"
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
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-yellow focus:outline-none"
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
