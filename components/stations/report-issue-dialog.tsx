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
  reportIssueAction,
  type ReportIssueState,
} from "@/app/(app)/stations/[id]/actions";

const CATEGORIES = [
  { value: "equipment", label: "Equipment / GSE" },
  { value: "facilities", label: "Facilities / Building" },
  { value: "safety", label: "Safety hazard" },
  { value: "ops", label: "Operational" },
  { value: "staffing", label: "Staffing" },
  { value: "weather", label: "Weather / Ramp" },
  { value: "fuel", label: "Fueling" },
  { value: "comms", label: "Communications" },
  { value: "other", label: "Other" },
] as const;

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;

export function ReportIssueDialog({
  stationId,
  stationLabel,
}: {
  stationId: string;
  stationLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ReportIssueState, FormData>(
    reportIssueAction,
    { status: "idle" },
  );

  // Close on success — the revalidatePath above re-renders the issues
  // list, so the user sees their new row appear in the open issues
  // section.
  useEffect(() => {
    if (state.status === "ok") {
      setOpen(false);
    }
  }, [state.status]);

  const fieldError = (key: string) =>
    state.status === "field-errors" ? state.errors[key] : undefined;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-status-blue bg-status-blue/15 px-3 py-1.5 text-xs font-semibold text-status-blue hover:bg-status-blue/20"
      >
        + Report Issue
      </button>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Report station issue</DialogTitle>
            <DialogDescription>
              Logged against{" "}
              <span className="font-mono font-semibold">{stationLabel}</span>.
              All open issues surface on the Ground Ops hub.
            </DialogDescription>
          </DialogHeader>

          <form action={action} className="space-y-4">
            <input type="hidden" name="station_id" value={stationId} />

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
                placeholder="Belt loader #2 hydraulics weak"
                aria-invalid={fieldError("title") ? "true" : undefined}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-blue focus:outline-none aria-[invalid=true]:border-status-red"
              />
              {fieldError("title") && (
                <p className="mt-1 text-[0.65rem] text-status-red">
                  {fieldError("title")}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="description"
                className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
              >
                Description <span className="text-status-red">*</span>
              </label>
              <textarea
                id="description"
                name="description"
                required
                rows={4}
                placeholder="What's happening, when did you notice, who's affected."
                aria-invalid={fieldError("description") ? "true" : undefined}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-blue focus:outline-none aria-[invalid=true]:border-status-red"
              />
              {fieldError("description") && (
                <p className="mt-1 text-[0.65rem] text-status-red">
                  {fieldError("description")}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="category"
                  className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
                >
                  Category
                </label>
                <select
                  id="category"
                  name="category"
                  defaultValue="other"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-blue focus:outline-none"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="priority"
                  className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
                >
                  Priority
                </label>
                <select
                  id="priority"
                  name="priority"
                  defaultValue="normal"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-blue focus:outline-none"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="assigned_to"
                className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
              >
                Assigned to (optional)
              </label>
              <input
                id="assigned_to"
                name="assigned_to"
                maxLength={200}
                placeholder="e.g. Marc"
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
                {pending ? "Submitting…" : "Submit issue"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
