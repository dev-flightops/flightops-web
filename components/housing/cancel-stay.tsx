"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelHousingBookingAction } from "@/app/(app)/housing/actions";
import { buttonOutline, buttonSolid } from "@/components/ff/controls";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function CancelStay({ bookingId, unitId, employee }: { bookingId: string; unitId: string; employee: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setPending(true);
    setError(null);
    try {
      const result = await cancelHousingBookingAction(bookingId, unitId);
      if (result.ok) { setOpen(false); router.refresh(); }
      else setError(result.error ?? "Couldn't cancel the stay.");
    } catch {
      setError("Connection interrupted. Check this booking before trying again.");
    } finally {
      setPending(false);
    }
  }

  return <>
    <button type="button" className="text-xs font-semibold hover:underline" onClick={() => { setError(null); setOpen(true); }}>Cancel stay</button>
    <Dialog open={open} onOpenChange={value => { if (!pending) setOpen(value); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel stay for {employee}?</DialogTitle>
          <DialogDescription>The stay will remain in the booking history as cancelled. Its reserved bed will be available for those nights.</DialogDescription>
        </DialogHeader>
        {error ? <p role="alert">{error}</p> : null}
        <div className="flex gap-3">
          <button type="button" className={buttonOutline} disabled={pending} onClick={() => setOpen(false)}>Keep stay</button>
          <button type="button" className={buttonSolid} disabled={pending} onClick={() => void cancel()}>{pending ? "Cancelling…" : "Cancel stay"}</button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
