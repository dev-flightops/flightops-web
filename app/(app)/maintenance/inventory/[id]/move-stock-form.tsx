"use client";

import { useState, useTransition } from "react";

import { buttonSolid } from "@/components/ff/controls";
import { Spinner } from "@/components/ui/spinner";

import { movePartAction } from "../actions";

type Move = "issued" | "received" | "returned";

const VERB: Record<Move, string> = {
  issued: "Issue",
  received: "Receive",
  returned: "Return",
};

/**
 * Stock in and out of a part (#172). Legacy had the route and no form for it, so
 * nothing recorded which aircraft a part went on, which is what Batch Trace is
 * for. An issue names its aircraft or work order; a work order fixes the aircraft.
 */
export function MoveStockForm({
  partId,
  unit,
  batch,
  lot,
  expired,
  aircraft,
  workOrders,
}: {
  partId: string;
  unit: string;
  batch: string | null;
  lot: string | null;
  expired: boolean;
  aircraft: { id: string; tail_number: string }[];
  workOrders: { id: string; wo_number: string; aircraft_id: string; title: string }[];
}) {
  const [move, setMove] = useState<Move>(expired ? "received" : "issued");
  const [quantity, setQuantity] = useState("1");
  const [aircraftId, setAircraftId] = useState("");
  const [workOrderId, setWorkOrderId] = useState("");
  const [reference, setReference] = useState("");
  const [batchNumber, setBatchNumber] = useState(batch ?? "");
  const [lotNumber, setLotNumber] = useState(lot ?? "");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const orders = aircraftId ? workOrders.filter((o) => o.aircraft_id === aircraftId) : workOrders;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await movePartAction({
        partId,
        txn_type: move,
        quantity,
        aircraft_id: move === "issued" ? aircraftId : "",
        work_order_id: move === "issued" ? workOrderId : "",
        reference,
        batch_number: batchNumber,
        lot_number: lotNumber,
        notes,
      });
      if (result.ok) {
        setMessage({ ok: true, text: `Recorded. Now ${result.qty} ${unit} on hand.` });
        setQuantity("1");
        setReference("");
        setNotes("");
      } else {
        setMessage({ ok: false, text: result.message });
      }
    });
  }

  return (
    <form method="post" onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="move-type" className="field-label">
            Move
          </label>
          <select id="move-type" value={move} onChange={(e) => setMove(e.target.value as Move)} className="ff-input px-3 py-2 text-sm">
            <option value="issued">Issue</option>
            <option value="received">Receive</option>
            <option value="returned">Return</option>
          </select>
        </div>
        <div>
          <label htmlFor="move-quantity" className="field-label">
            Quantity ({unit})
          </label>
          <input
            id="move-quantity"
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="ff-input px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="move-reference" className="field-label">
            Reference
          </label>
          <input
            id="move-reference"
            maxLength={200}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="PO, packing slip"
            className="ff-input px-3 py-2 text-sm"
          />
        </div>
      </div>
      {move === "issued" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="move-aircraft" className="field-label">
              Aircraft
            </label>
            <select
              id="move-aircraft"
              value={aircraftId}
              onChange={(e) => {
                setAircraftId(e.target.value);
                setWorkOrderId("");
              }}
              className="ff-input px-3 py-2 text-sm"
            >
              <option value="">Not going on an aircraft</option>
              {aircraft.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.tail_number}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="move-work-order" className="field-label">
              Work Order
            </label>
            <select
              id="move-work-order"
              value={workOrderId}
              onChange={(e) => setWorkOrderId(e.target.value)}
              className="ff-input px-3 py-2 text-sm"
            >
              <option value="">None</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.wo_number} · {o.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="move-batch" className="field-label">
            Batch
          </label>
          <input id="move-batch" maxLength={100} value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} className="ff-input px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="move-lot" className="field-label">
            Lot
          </label>
          <input id="move-lot" maxLength={100} value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} className="ff-input px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="move-notes" className="field-label">
            Notes
          </label>
          <input id="move-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="ff-input px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonSolid}>
          {VERB[move]} Stock
        </button>
        {pending ? <Spinner size="xs" /> : null}
        {message ? (
          <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-sm text-status-green" : "text-sm text-status-red"}>
            {message.text}
          </p>
        ) : null}
      </div>
    </form>
  );
}
