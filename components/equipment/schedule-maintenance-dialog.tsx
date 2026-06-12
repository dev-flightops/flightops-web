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
  scheduleMaintenanceAction,
  type EquipmentActionState,
} from "@/app/(app)/equipment/[id]/actions";

const ITEM_TYPES = [
  { value: "service", label: "Service" },
  { value: "inspection", label: "Inspection" },
  { value: "calibration", label: "Calibration" },
  { value: "certification", label: "Certification" },
  { value: "custom", label: "Custom" },
] as const;

export function ScheduleMaintenanceDialog({ unitId }: { unitId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<
    EquipmentActionState,
    FormData
  >(scheduleMaintenanceAction, { status: "idle" });

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
        className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/40"
      >
        + Schedule MX
      </button>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Schedule maintenance</DialogTitle>
            <DialogDescription>
              Recurring items recompute their next due date when completed,
              using the interval you set.
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
                htmlFor="title"
                className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
              >
                Title <span className="text-status-red">*</span>
              </label>
              <input
                id="title"
                name="title"
                required
                maxLength={300}
                placeholder="100hr inspection"
                aria-invalid={fieldError("title") ? "true" : undefined}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-blue focus:outline-none aria-[invalid=true]:border-status-red"
              />
              {fieldError("title") && (
                <p className="mt-1 text-[0.65rem] text-status-red">
                  {fieldError("title")}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="item_type"
                  className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
                >
                  Type
                </label>
                <select
                  id="item_type"
                  name="item_type"
                  defaultValue="service"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-blue focus:outline-none"
                >
                  {ITEM_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="due_date"
                  className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
                >
                  Due date (optional)
                </label>
                <input
                  id="due_date"
                  name="due_date"
                  type="date"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-blue focus:outline-none"
                />
              </div>
            </div>

            <p className="text-[0.65rem] text-muted-foreground/70">
              Provide at least one interval (days or hours). Both are
              allowed — the recurring recompute uses whichever applies.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="interval_days"
                  className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
                >
                  Interval (days)
                </label>
                <input
                  id="interval_days"
                  name="interval_days"
                  type="number"
                  min={1}
                  placeholder="30"
                  aria-invalid={
                    fieldError("interval_days") ? "true" : undefined
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-blue focus:outline-none aria-[invalid=true]:border-status-red"
                />
                {fieldError("interval_days") && (
                  <p className="mt-1 text-[0.65rem] text-status-red">
                    {fieldError("interval_days")}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="interval_hours"
                  className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
                >
                  Interval (hours)
                </label>
                <input
                  id="interval_hours"
                  name="interval_hours"
                  type="number"
                  step="0.1"
                  min={0.1}
                  placeholder="100"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-blue focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="description"
                className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
              >
                Description (optional)
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                placeholder="Specifics, references, notes."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-blue focus:outline-none"
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card/40 px-3 py-2 text-xs text-foreground">
              <input
                type="checkbox"
                name="is_recurring"
                defaultChecked
                className="h-4 w-4 cursor-pointer accent-status-blue"
              />
              <span>
                Recurring — recompute next due date when completed
              </span>
            </label>

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
                {pending ? "Scheduling…" : "Schedule"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
