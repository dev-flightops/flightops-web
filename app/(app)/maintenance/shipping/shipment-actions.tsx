"use client";

import { useState, useTransition } from "react";

import { buttonOutline } from "@/components/ff/controls";
import { Spinner } from "@/components/ui/spinner";
import type { PartShipment } from "@/lib/api/part-logistics";

import { updateShipmentStatusAction } from "./actions";

/**
 * A shipment's next steps (#178): a vendor order ships, a shipment goes in
 * transit, arrives (its stock received at the destination on the day given),
 * or is cancelled (stock between bases goes back to the sender).
 */
export function ShipmentActions({ shipment, today }: { shipment: PartShipment; today: string }) {
  const [arrivedOn, setArrivedOn] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const open = shipment.status === "ordered" || shipment.status === "shipped" || shipment.status === "in_transit";
  if (!open) return null;

  function go(status: "shipped" | "in_transit" | "arrived" | "cancelled", on?: string) {
    setError(null);
    startTransition(async () => {
      const result = await updateShipmentStatusAction(shipment.id, { status, on: on ?? null });
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {pending ? <Spinner size="xs" /> : null}
        {shipment.status === "ordered" ? (
          <button type="button" disabled={pending} onClick={() => go("shipped")} className={buttonOutline}>
            Shipped
          </button>
        ) : null}
        {shipment.status === "shipped" ? (
          <button type="button" disabled={pending} onClick={() => go("in_transit")} className={buttonOutline}>
            In Transit
          </button>
        ) : null}
        <label className="sr-only" htmlFor={`arrived-${shipment.id}`}>
          Arrival date for {shipment.part_number}
        </label>
        <input
          id={`arrived-${shipment.id}`}
          type="date"
          value={arrivedOn}
          max={today}
          onChange={(e) => setArrivedOn(e.target.value)}
          className="ff-input w-36 px-2 py-1 text-xs"
        />
        <button type="button" disabled={pending} onClick={() => go("arrived", arrivedOn)} className={buttonOutline}>
          Arrived
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const back = shipment.kind === "transfer" ? ` Its ${shipment.quantity} ${shipment.unit} go back to ${shipment.origin_base}.` : "";
            if (window.confirm(`Cancel this shipment?${back}`)) go("cancelled");
          }}
          className="px-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
      {error ? (
        <span role="alert" className="field-error">
          {error}
        </span>
      ) : null}
    </div>
  );
}
