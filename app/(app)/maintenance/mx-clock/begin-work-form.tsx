"use client";

import { useState, useTransition } from "react";

import { buttonSolid } from "@/components/ff/controls";
import { Spinner } from "@/components/ui/spinner";

import { startClockAction } from "./actions";

/**
 * Begin Maintenance (#172). Legacy typed a work order's number; here it's picked
 * from the aircraft's open ones.
 */
export function BeginWorkForm({
  aircraft,
  workOrders,
}: {
  aircraft: { id: string; tail_number: string; model: string | null }[];
  workOrders: { id: string; wo_number: string; aircraft_id: string; title: string }[];
}) {
  const [aircraftId, setAircraftId] = useState("");
  const [workOrderId, setWorkOrderId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const orders = workOrders.filter((o) => o.aircraft_id === aircraftId);

  return (
    <form
      method="post"
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await startClockAction({ aircraftId, workOrderId, notes });
          if (result.ok) {
            setAircraftId("");
            setWorkOrderId("");
            setNotes("");
          } else {
            setError(result.message);
          }
        });
      }}
    >
      <div>
        <label htmlFor="clock-aircraft" className="field-label">
          Aircraft
        </label>
        <select
          id="clock-aircraft"
          required
          value={aircraftId}
          onChange={(e) => {
            setAircraftId(e.target.value);
            setWorkOrderId("");
          }}
          className="ff-input w-64 px-3 py-2 text-sm"
        >
          <option value="">Select…</option>
          {aircraft.map((a) => (
            <option key={a.id} value={a.id}>
              {a.tail_number}
              {a.model ? ` ${a.model}` : ""}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="clock-work-order" className="field-label">
          Work Order (optional)
        </label>
        <select
          id="clock-work-order"
          value={workOrderId}
          disabled={!aircraftId}
          onChange={(e) => setWorkOrderId(e.target.value)}
          className="ff-input w-56 px-3 py-2 text-sm"
        >
          <option value="">None</option>
          {orders.map((o) => (
            <option key={o.id} value={o.id}>
              {o.wo_number} · {o.title}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-[200px] flex-1">
        <label htmlFor="clock-notes" className="field-label">
          Notes
        </label>
        <input
          id="clock-notes"
          value={notes}
          maxLength={2000}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What are you working on?"
          className="ff-input px-3 py-2 text-sm"
        />
      </div>
      <button type="submit" disabled={pending} className={buttonSolid}>
        Begin Work
      </button>
      {pending ? <Spinner size="xs" /> : null}
      {error ? (
        <p role="alert" className="w-full text-sm text-status-red">
          {error}
        </p>
      ) : null}
    </form>
  );
}
