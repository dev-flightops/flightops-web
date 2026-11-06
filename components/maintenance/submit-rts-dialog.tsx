"use client";

import { useState } from "react";

import { SignOffForm } from "@/app/(app)/maintenance/rts/rts-forms";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Legacy's "Submit RTS" on a squawk (#172): the AMT's sign-off with their
 * certificate, beside the plain Resolve, which legacy called Direct Resolve.
 */
export function SubmitRtsDialog({
  squawkId,
  aircraftId,
  title,
  name,
  rii = false,
}: {
  squawkId: string;
  aircraftId: string;
  title: string;
  /** The viewer's name, to start from. */
  name: string;
  rii?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Submit RTS
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>AMT Return to Service Signoff</DialogTitle>
            <DialogDescription>
              {title}. A non-RII item returns to service straight away. An RII item needs a second person to inspect it.
            </DialogDescription>
          </DialogHeader>
          <SignOffForm squawkId={squawkId} aircraftId={aircraftId} name={name} rii={rii} idPrefix="dialog" onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
