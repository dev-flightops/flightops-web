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
  resolveIssueAction,
  type ResolveIssueState,
} from "@/app/(app)/stations/[id]/actions";

export function ResolveIssueButton({
  stationId,
  issueId,
  issueTitle,
}: {
  stationId: string;
  issueId: string;
  issueTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<
    ResolveIssueState,
    FormData
  >(resolveIssueAction, { status: "idle" });

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
        Resolve
      </button>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Resolve issue</DialogTitle>
            <DialogDescription>
              <span className="font-semibold">{issueTitle}</span>
            </DialogDescription>
          </DialogHeader>

          <form action={action} className="space-y-4">
            <input type="hidden" name="station_id" value={stationId} />
            <input type="hidden" name="issue_id" value={issueId} />

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
                htmlFor="resolution_notes"
                className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
              >
                Resolution notes <span className="text-status-red">*</span>
              </label>
              <textarea
                id="resolution_notes"
                name="resolution_notes"
                required
                rows={4}
                placeholder="What was done to clear this issue?"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-green focus:outline-none"
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
                {pending ? "Resolving…" : "Mark resolved"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
