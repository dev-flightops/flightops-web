"use client";

import { deleteWorkOrderAction } from "@/app/(app)/maintenance/work-orders/actions";
import { DeleteRecord } from "./delete-record";

/** A work order nobody signed off. */
export function DeleteWorkOrder({ workOrderId, woNumber }: { workOrderId: string; woNumber: string }) {
  return (
    <DeleteRecord
      label="Delete work order"
      title={`Delete ${woNumber}?`}
      description="For a work order opened as a test or in error: it goes for good, with its timeline. One that was signed off, or has parts, hours or an inspection on it, stays on the aircraft's record."
      action={() => deleteWorkOrderAction(workOrderId)}
      redirectTo="/maintenance/work-orders"
    />
  );
}
