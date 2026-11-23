"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckGlyph } from "@/components/ff/glyphs";

import { closeMelDeferralAction } from "@/app/(app)/dispatch/maintenance-actions";
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
  toClosure,
} from "@/components/maintenance/sign-off-fields";

export interface CloseMelDialogProps {
  melItemId: string;
  /** Used in the dialog title so the dispatcher can see which item
   *  they're about to close. Backend already knows; this is for the
   *  human. */
  ataChapter: string;
  description: string;
}

/**
 * Confirms a MEL closure (M2-G-17), signed off (1119-19): the repair, the
 * mechanic, their certificate and their statement, or that no work was
 * done and why (one deferred in error). Submits to the
 * `closeMelDeferralAction` server action, refreshes the panel on
 * success, surfaces server errors inline.
 */
export function CloseMelDialog({
  melItemId,
  ataChapter,
  description,
}: CloseMelDialogProps) {
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
    startTransition(async () => {
      const result = await closeMelDeferralAction(melItemId, toClosure(signOff));
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
        <CheckGlyph className="h-3.5 w-3.5" />
        Close
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => (isPending ? null : o ? setOpen(true) : closeAndReset())}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Close MEL · ATA {ataChapter}</DialogTitle>
            <DialogDescription>
              Clear this MEL item once the equipment is repaired or replaced,
              signed off by the mechanic. The closure is stamped with your
              login and the time, and recorded in the audit trail.
            </DialogDescription>
          </DialogHeader>

          <form method="post" onSubmit={onSubmit} className="space-y-3">
            <p className="rounded-md border border-border bg-muted/60 px-3 py-2 text-xs text-foreground">
              {description}
            </p>

            <SignOffFields
              idPrefix={`close-mel-${melItemId}`}
              value={signOff}
              onChange={setSignOff}
              allowNoWork
              workLabel="Repair done"
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
                {isPending ? "Closing…" : "Close MEL"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
