"use client";

import { useState, useTransition } from "react";

import { buttonOutline, buttonSolid } from "@/components/ff/controls";
import { Spinner } from "@/components/ui/spinner";
import type { PartRequest } from "@/lib/api/part-logistics";

import { approveRequestAction, cancelRequestAction, denyRequestAction, shipRequestAction } from "./actions";

/**
 * A request's next steps (#178), legacy's Approve, Deny and Ship It. Denying
 * says why; shipping enters the shipment from the base that holds the stock.
 */
export function RequestActions({ request }: { request: PartRequest }) {
  const [mode, setMode] = useState<"deny" | "ship" | null>(null);
  const [why, setWhy] = useState("");
  const [ship, setShip] = useState({ airway_bill: "", carrier: "", est_arrival_on: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (request.status !== "pending" && request.status !== "approved") return null;

  function run(action: () => Promise<{ ok: true } | { ok: false; message: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) setMode(null);
      else setError(result.message);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      {mode === null ? (
        <div className="flex flex-wrap justify-end gap-1.5">
          {pending ? <Spinner size="xs" /> : null}
          {request.status === "pending" ? (
            <button type="button" disabled={pending} onClick={() => run(() => approveRequestAction(request.id))} className={buttonOutline}>
              Approve
            </button>
          ) : (
            <button type="button" disabled={pending} onClick={() => setMode("ship")} className={buttonSolid}>
              Ship It
            </button>
          )}
          <button type="button" disabled={pending} onClick={() => setMode("deny")} className={`${buttonOutline} text-status-red`}>
            Deny
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (window.confirm("Withdraw this request?")) run(() => cancelRequestAction(request.id));
            }}
            className="px-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Withdraw
          </button>
        </div>
      ) : mode === "deny" ? (
        <form
          method="post"
          className="flex w-full max-w-xs flex-col gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => denyRequestAction(request.id, why));
          }}
        >
          <label htmlFor={`why-${request.id}`} className="field-label">
            Why it&apos;s denied
          </label>
          <input id={`why-${request.id}`} value={why} onChange={(e) => setWhy(e.target.value)} className="ff-input px-2 py-1 text-xs" />
          <span className="flex justify-end gap-1.5">
            <button type="button" onClick={() => setMode(null)} className={buttonOutline}>
              Back
            </button>
            <button type="submit" disabled={pending} className={`${buttonOutline} text-status-red`}>
              Deny Request
            </button>
          </span>
        </form>
      ) : (
        <form
          method="post"
          className="flex w-full max-w-xs flex-col gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => shipRequestAction(request.id, ship));
          }}
        >
          <label htmlFor={`awb-${request.id}`} className="field-label">
            Airway Bill
          </label>
          <input
            id={`awb-${request.id}`}
            value={ship.airway_bill}
            onChange={(e) => setShip((s) => ({ ...s, airway_bill: e.target.value }))}
            className="ff-input px-2 py-1 font-mono text-xs"
          />
          <label htmlFor={`carrier-${request.id}`} className="field-label">
            Carrier
          </label>
          <input
            id={`carrier-${request.id}`}
            value={ship.carrier}
            onChange={(e) => setShip((s) => ({ ...s, carrier: e.target.value }))}
            className="ff-input px-2 py-1 text-xs"
          />
          <label htmlFor={`eta-${request.id}`} className="field-label">
            Expected Arrival
          </label>
          <input
            id={`eta-${request.id}`}
            type="date"
            value={ship.est_arrival_on}
            onChange={(e) => setShip((s) => ({ ...s, est_arrival_on: e.target.value }))}
            className="ff-input px-2 py-1 text-xs"
          />
          <span className="flex justify-end gap-1.5">
            <button type="button" onClick={() => setMode(null)} className={buttonOutline}>
              Back
            </button>
            <button type="submit" disabled={pending} className={buttonSolid}>
              Ship {request.quantity} {request.unit}
            </button>
          </span>
        </form>
      )}
      {error ? (
        <span role="alert" className="field-error">
          {error}
        </span>
      ) : null}
    </div>
  );
}
