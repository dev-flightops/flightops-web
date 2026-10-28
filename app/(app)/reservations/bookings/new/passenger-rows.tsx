"use client";

import { useState } from "react";

/**
 * Who the booking is for, by name (#137). On a flight they're its
 * manifest's passengers, so the manifest fills itself from the booking:
 * the client's "booking added to master schedule flight - manifest auto
 * updates". Notes ride along to the manifest (Wheelchair assist).
 *
 * The first row takes the customer's name until it's typed over; the
 * passenger count is the rows.
 */
interface Row {
  first: string;
  last: string;
  weight: string;
  notes: string;
  typed: boolean;
}

function split(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { first: parts[0] ?? "", last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

function blank(): Row {
  return { first: "", last: "", weight: "", notes: "", typed: false };
}

export function PassengerRows({
  initialCount,
  customerName,
  error,
}: {
  initialCount: number;
  customerName: string;
  error?: string;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    Array.from({ length: Math.min(Math.max(initialCount, 1), 99) }, blank),
  );
  const named = split(customerName);
  const shown = rows.map((row, i) =>
    i === 0 && !row.typed ? { ...row, first: named.first, last: named.last } : row,
  );

  function update(index: number, change: Partial<Row>) {
    setRows((current) =>
      current.map((row, i) =>
        i === index
          ? { ...(i === 0 && !row.typed ? { ...row, ...named } : row), ...change, typed: true }
          : row,
      ),
    );
  }

  return (
    <fieldset className="min-w-0">
      <legend className="field-label">Passengers</legend>
      <input type="hidden" name="pax_count" value={shown.length} />
      <div className="space-y-2">
        {shown.map((row, i) => (
          <div
            key={i}
            role="group"
            aria-label={`Passenger ${i + 1}`}
            className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_6rem_1.4fr_auto]"
          >
            <input
              name="passenger_first_name"
              aria-label={`Passenger ${i + 1} first name`}
              required
              maxLength={80}
              placeholder="First name"
              value={row.first}
              onChange={(e) => update(i, { first: e.target.value })}
              className="ff-input"
            />
            <input
              name="passenger_last_name"
              aria-label={`Passenger ${i + 1} last name`}
              required
              maxLength={80}
              placeholder="Last name"
              value={row.last}
              onChange={(e) => update(i, { last: e.target.value })}
              className="ff-input"
            />
            <input
              name="passenger_weight_lbs"
              aria-label={`Passenger ${i + 1} weight (lb)`}
              type="number"
              min={0}
              max={1000}
              step="1"
              placeholder="Weight lb"
              value={row.weight}
              onChange={(e) => update(i, { weight: e.target.value })}
              className="ff-input"
            />
            <input
              name="passenger_notes"
              aria-label={`Passenger ${i + 1} notes`}
              maxLength={500}
              placeholder="Notes, e.g. wheelchair assist"
              value={row.notes}
              onChange={(e) => update(i, { notes: e.target.value })}
              className="ff-input"
            />
            {shown.length > 1 ? (
              <button
                type="button"
                onClick={() => setRows((current) => current.filter((_, j) => j !== i))}
                className="btn-caps px-2 text-[0.68rem] text-muted-foreground hover:text-foreground"
                aria-label={`Remove passenger ${i + 1}`}
              >
                Remove
              </button>
            ) : (
              <span aria-hidden />
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setRows((current) => (current.length < 99 ? [...current, blank()] : current))}
        className="btn-caps mt-2 inline-flex items-center rounded-md border border-input px-3 py-1.5 text-[0.7rem] text-foreground hover:bg-accent"
      >
        + Add passenger
      </button>
      {error ? (
        <p className="field-error">{error}</p>
      ) : (
        <p className="mt-1 text-[0.6875rem] text-muted-foreground">
          On a flight they go on its manifest, where weights are confirmed at check-in.
        </p>
      )}
    </fieldset>
  );
}
