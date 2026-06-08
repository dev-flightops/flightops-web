"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

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
import { Label } from "@/components/ui/label";

export interface CloseMelDialogProps {
  melItemId: string;
  /** Used in the dialog title so the dispatcher can see which item
   *  they're about to close. Backend already knows; this is for the
   *  human. */
  ataChapter: string;
  description: string;
}

/**
 * Confirms a MEL closure (M2-G-17). Optional notes textarea — backend
 * appends to any existing notes (it doesn't overwrite). Submits to the
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
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const closeAndReset = () => {
    setOpen(false);
    setError(null);
    setNotes("");
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await closeMelDeferralAction(melItemId, {
        notes: notes.trim() || null,
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
        <Check className="h-3.5 w-3.5" />
        Close
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => (isPending ? null : o ? setOpen(true) : closeAndReset())}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Close MEL · ATA {ataChapter}</DialogTitle>
            <DialogDescription>
              Mark this MEL item as closed (equipment repaired or replaced).
              The closure is stamped with your login + the current time and
              recorded in the audit trail.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-3">
            <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-foreground">
              {description}
            </p>

            <div>
              <Label htmlFor="close-mel-notes">Closing notes (optional)</Label>
              <textarea
                id="close-mel-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Replaced controller P/N XXXX-YY; tested OK on ground run."
                className="mt-1.5 flex w-full rounded-lg border border-border bg-background px-3 py-2 text-[0.8125rem] focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
              />
              <p className="mt-1 text-[0.65rem] text-muted-foreground">
                Appended to any existing notes on this MEL — not a replacement.
              </p>
            </div>

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
