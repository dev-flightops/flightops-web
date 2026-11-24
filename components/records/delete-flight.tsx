"use client";

import { deleteFlightAction } from "@/app/(app)/dispatch/[flightId]/actions";
import { DeleteRecord } from "./delete-record";

/** A cancelled flight that never left. */
export function DeleteFlight({ flightId, flightNumber }: { flightId: string; flightNumber: string }) {
  return (
    <DeleteRecord
      label="Delete flight"
      title={`Delete ${flightNumber}?`}
      description="For a flight made as a test: it goes for good, with its legs, crew, FRATs and manifest, and leaves the lists. A cancelled booking on it keeps its own record. One that departed, or has a log, pay or an invoice, stays on record."
      action={() => deleteFlightAction(flightId)}
      redirectTo="/flight-following"
    />
  );
}
