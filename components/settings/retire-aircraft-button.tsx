"use client";

import { useActionState, useEffect, useState } from "react";

import {
  reactivateAircraftAction,
  retireAircraftAction,
  type FleetActionState,
} from "@/app/(app)/settings/fleet/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

/** Retire (soft-delete) button. Aircraft flip to is_active=False; row
 *  stays for FK safety. Confirmation dialog because retiring an
 *  in-fleet airframe should not be a one-click action. */
export function RetireAircraftButton({
  aircraftId,
  tailNumber,
}: {
  aircraftId: string;
  tailNumber: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FleetActionState, FormData>(
    retireAircraftAction,
    { status: "idle" },
  );

  useEffect(() => {
    if (state.status === "ok") setOpen(false);
  }, [state.status]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-status-red/40 bg-status-red/10 px-2.5 py-1 text-[0.7rem] font-semibold text-status-red hover:bg-status-red/20"
      >
        Retire
      </button>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Retire {tailNumber}?</DialogTitle>
            <DialogDescription>
              The aircraft will be hidden from active fleet lists (dispatch,
              fleet board, new-booking picker). Historical flights, logs, and
              audit rows are preserved. You can reactivate any time.
            </DialogDescription>
          </DialogHeader>

          {state.status === "api-error" && (
            <div
              role="alert"
              className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
            >
              {state.message}
            </div>
          )}

          <form action={action}>
            <input type="hidden" name="aircraft_id" value={aircraftId} />
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
                className="inline-flex items-center gap-1.5 rounded-md bg-status-red px-4 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
              >
                {pending && <Spinner size="xs" />}
                {pending ? "Retiring…" : "Retire aircraft"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Reactivate — one-click flip is_active back to True. No confirmation
 *  because it's a reversible, low-blast-radius operation. */
export function ReactivateAircraftButton({ aircraftId }: { aircraftId: string }) {
  const [state, action, pending] = useActionState<FleetActionState, FormData>(
    reactivateAircraftAction,
    { status: "idle" },
  );
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="aircraft_id" value={aircraftId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-md border border-status-green/40 bg-status-green/10 px-2.5 py-1 text-[0.7rem] font-semibold text-status-green hover:bg-status-green/20 disabled:opacity-60"
      >
        {pending && <Spinner size="xs" />}
        {pending ? "…" : "Reactivate"}
      </button>
      {state.status === "api-error" && (
        <span role="alert" className="text-[0.65rem] text-status-red">
          {state.message}
        </span>
      )}
    </form>
  );
}
