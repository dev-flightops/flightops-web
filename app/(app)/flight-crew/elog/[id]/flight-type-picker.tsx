"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Spinner } from "@/components/ui/spinner";
import type { FlightType } from "@/lib/api/types";

import { FLIGHT_TYPE_LABELS } from "./flight-type-labels";
import { updateSummaryAction } from "./summary-actions";

/**
 * The log's flight type on Tab 1 (#104).
 *
 * The client, 22 Oct: "How is the flight type decided? Would like to be
 * able to edit that field after flight has occurred." It is picked when
 * the log is started and could not be changed after; legacy's Tab 1 has
 * it as a select the pilot changes while the log is open, and so does
 * this. A submitted log is reopened first, as for its other fields.
 *
 * Saves on change, like the SIC picker beside it.
 */
export function FlightTypePicker({
  logId,
  initialType,
}: {
  logId: string;
  initialType: FlightType;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState<FlightType>(initialType);

  function commit(next: FlightType) {
    setValue(next);
    if (next === initialType) return;
    startTransition(async () => {
      setError(null);
      const result = await updateSummaryAction(logId, { flight_type: next });
      if (result.status === "error") {
        setError(result.message);
        setValue(initialType);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="min-w-0">
      <label htmlFor="flight-type" className="eyebrow mb-1 flex items-center gap-1.5">
        Flight Type
        {pending ? <Spinner size="xs" /> : null}
      </label>
      <select
        id="flight-type"
        value={value}
        disabled={pending}
        onChange={(e) => commit(e.target.value as FlightType)}
        className="ff-input px-2 py-1 text-sm"
      >
        {(Object.keys(FLIGHT_TYPE_LABELS) as FlightType[]).map((type) => (
          <option key={type} value={type}>
            {FLIGHT_TYPE_LABELS[type]}
          </option>
        ))}
      </select>
      {error ? (
        <p role="alert" className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
