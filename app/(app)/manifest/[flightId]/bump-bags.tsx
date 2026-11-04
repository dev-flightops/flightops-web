"use client";

import Link from "next/link";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { buttonSolid, buttonOutline, linkCaps } from "@/components/ff/controls";
import { bumpBagsAction } from "./actions";

export function BumpBags({ flightId, paxId, name, baggageLbs }: {flightId:string; paxId:string; name:string; baggageLbs:string}) {
  const [open,setOpen] = useState(false);
  const [weight,setWeight] = useState(baggageLbs);
  const [pieces,setPieces] = useState("1");
  const [reason,setReason] = useState("");
  const [pending,setPending] = useState(false);
  const [error,setError] = useState<string|null>(null);
  const [moved,setMoved] = useState(false);
  return <>
    <button type="button" className="text-xs font-semibold hover:underline" onClick={() => {setOpen(true); setMoved(false); setWeight(baggageLbs); setError(null);}}>Bump bags</button>
    <Dialog open={open} onOpenChange={value => {if(!pending)setOpen(value);}}>
      <DialogContent><DialogHeader><DialogTitle>Bump bags — {name}</DialogTitle><DialogDescription>Take bags off this manifest and keep them in Mail &amp; Freight for the next flight. The passenger and booking remain linked to the waiting bags.</DialogDescription></DialogHeader>
        {moved ? <div role="status" className="space-y-3"><p>Bags moved to the waiting-load queue. The manifest’s baggage weight has been reduced.</p><Link className={linkCaps} href="/manifest/waiting">Find the waiting bags</Link></div> : <form method="post" className="space-y-4" onSubmit={event => {
          event.preventDefault(); setPending(true); setError(null);
          void (async () => {try {
            const result = await bumpBagsAction(flightId,paxId,{weight_lbs:weight,pieces:Number(pieces),reason});
            if(result.ok) setMoved(true); else setError(result.error ?? "Could not move the bags.");
          } catch {setError("Connection interrupted. Check the manifest and waiting list before retrying.");} finally {setPending(false);}})();
        }}>
          <label className="block">Weight to bump (lb)<input className="field-input mt-1 w-full rounded border border-input bg-background p-2" type="number" min="0.1" step="0.1" max={baggageLbs} required disabled={pending} value={weight} onChange={event=>setWeight(event.target.value)}/></label>
          <label className="block">Bag count<input className="mt-1 w-full rounded border border-input bg-background p-2" type="number" min="1" max="1000" step="1" required disabled={pending} value={pieces} onChange={event=>setPieces(event.target.value)}/></label>
          <label className="block">Reason<textarea className="mt-1 w-full rounded border border-input bg-background p-2" required maxLength={500} disabled={pending} value={reason} onChange={event=>setReason(event.target.value)}/></label>
          {error && <p role="alert">{error}</p>}
          <div className="flex gap-3"><button type="submit" className={buttonSolid} disabled={pending}>{pending?"Moving bags…":"Move bags to waiting list"}</button><button type="button" className={buttonOutline} disabled={pending} onClick={()=>setOpen(false)}>Back</button></div>
        </form>}
      </DialogContent>
    </Dialog>
  </>;
}
