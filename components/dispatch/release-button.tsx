"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

import { releaseFlightAction } from "@/app/(app)/dispatch/[flightId]/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ReleaseButtonProps {
  flightId: string;
  flightNumber: string;
  origin: string;
  destination: string;
}

export function ReleaseButton({
  flightId,
  flightNumber,
  origin,
  destination,
}: ReleaseButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleRelease = () => {
    setError(null);
    startTransition(async () => {
      const result = await releaseFlightAction(flightId);
      if (result.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Send className="h-4 w-4" />
        Release dispatch
      </Button>

      <Dialog open={open} onOpenChange={(o) => !isPending && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Release {flightNumber}?</DialogTitle>
            <DialogDescription>
              Locks the flight plan for{" "}
              <span className="font-mono">
                {origin} → {destination}
              </span>{" "}
              and marks it as released. This action is recorded in the audit log
              and cannot be undone.
            </DialogDescription>
          </DialogHeader>

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
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleRelease} disabled={isPending}>
              {isPending ? "Releasing…" : "Release"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
