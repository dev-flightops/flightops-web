"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Wrench } from "lucide-react";

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
import { Label } from "@/components/ui/label";

export interface ResolveSquawkDialogProps {
  squawkId: string;
  title: string;
  severity: "minor" | "major" | "grounding";
}

/**
 * Resolve-squawk dialog (M2-G-17). Unlike close-MEL, resolution_notes
 * is REQUIRED (backend enforces min_length=1 — squawk closures need a
 * documented fix for the audit trail). Posts to resolveSquawkAction,
 * refreshes the maintenance panel on success.
 */
export function ResolveSquawkDialog({
  squawkId,
  title,
  severity,
}: ResolveSquawkDialogProps) {
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
    const trimmed = notes.trim();
    if (!trimmed) {
      setError("Resolution notes are required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await resolveSquawkAction(squawkId, {
        resolution_notes: trimmed,
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
        <Wrench className="h-3.5 w-3.5" />
        Resolve
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => (isPending ? null : o ? setOpen(true) : closeAndReset())}
      >
        <DialogContent className="sm:max-w-md">
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

          <form onSubmit={onSubmit} className="space-y-3">
            <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-foreground">
              {title}
            </p>

            <div>
              <Label htmlFor="resolve-notes">
                Resolution notes <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="resolve-notes"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What did you do to clear this? Replace P/N, adjust tolerances, deferred via MEL #..., etc."
                className="mt-1.5 flex w-full rounded-lg border border-border bg-background px-3 py-2 text-[0.8125rem] focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
              />
              <p className="mt-1 text-[0.65rem] text-muted-foreground">
                Required — every squawk closure needs a documented fix for
                the audit trail.
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
                {isPending ? "Resolving…" : "Resolve squawk"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
