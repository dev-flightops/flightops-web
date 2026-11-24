"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DeleteResult } from "@/lib/records/delete-refusal";

/**
 * Delete a test record for good (1119-30, the client's 11/19 audit:
 * "Flights can only be cancelled, work orders only closed, and customers
 * can't be deleted, so test records stay in lists"). For Exec Admins. The
 * server refuses anything that is part of the operation's record and the
 * dialog shows its reason; each delete is logged.
 */
export function DeleteRecord({
  label,
  title,
  description,
  action,
  redirectTo,
}: {
  label: string;
  title: string;
  description: string;
  action: () => Promise<DeleteResult>;
  redirectTo: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    if (pending) return;
    setOpen(false);
    setError(null);
  }

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setOpen(false);
        router.push(redirectTo);
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="border-status-red/40 text-status-red hover:border-status-red"
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <Dialog open={open} onOpenChange={(next) => (next ? null : close())}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {error ? (
            <p role="alert" className="notice notice-red">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={pending}>
              Keep it
            </Button>
            <Button type="button" variant="destructive" onClick={confirm} disabled={pending}>
              {pending ? "Deleting…" : label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

