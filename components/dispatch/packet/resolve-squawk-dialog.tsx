"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { resolveSquawkAction } from "@/app/(app)/dispatch/maintenance-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EMPTY_SIGN_OFF,
  SignOffFields,
  signOffProblem,
  toSignOff,
} from "@/components/maintenance/sign-off-fields";

export interface ResolveSquawkDialogProps {
  squawkId: string;
  title: string;
  severity: "minor" | "major" | "grounding";
}

/**
 * Resolve-squawk dialog (M2-G-17). Resolving returns what the squawk
 * grounded to service, so it is signed off as on the RTS queue (1119-19):
 * the work done, the mechanic, their certificate and its kind, and their
 * statement. Posts to resolveSquawkAction, refreshes the maintenance panel
 * on success.
 */
export function ResolveSquawkDialog({
  squawkId,
  title,
  severity,
}: ResolveSquawkDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signOff, setSignOff] = useState(EMPTY_SIGN_OFF);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const closeAndReset = () => {
    setOpen(false);
    setError(null);
    setSignOff(EMPTY_SIGN_OFF);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const problem = signOffProblem(signOff);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    const signed = toSignOff(signOff);
    startTransition(async () => {
      const result = await resolveSquawkAction(squawkId, {
        resolution_notes: signed.work_done,
        signer_name: signed.signer_name,
        cert_number: signed.cert_number,
        cert_type: signed.cert_type,
        airworthy: true,
      });
      if (result.ok) {
        closeAndReset();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        Resolve
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => (isPending ? null : o ? setOpen(true) : closeAndReset())}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Resolve squawk</DialogTitle>
            <DialogDescription>
              Mark this squawk as resolved. Resolution is stamped with your
              login + the current time and recorded in the audit trail. The
              {severity === "grounding"
                ? " aircraft will become dispatchable again once this is"
                : " advisory will drop off the maintenance panel once this is"}{" "}
              saved.
            </DialogDescription>
          </DialogHeader>

          <form method="post" onSubmit={onSubmit} className="space-y-3">
            <p className="rounded-md border border-border bg-muted/60 px-3 py-2 text-xs text-foreground">
              {title}
            </p>

            <SignOffFields
              idPrefix={`resolve-${squawkId}`}
              value={signOff}
              onChange={setSignOff}
              workLabel="Resolution: what was done"
              disabled={isPending}
            />

            {error && (
              <p
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeAndReset}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Resolving…" : "Resolve squawk"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
