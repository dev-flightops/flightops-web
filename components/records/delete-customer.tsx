"use client";

import { deleteCustomerAction } from "@/app/(app)/customers/[id]/actions";
import { DeleteRecord } from "./delete-record";

/** A customer who never flew. */
export function DeleteCustomer({ customerId, name }: { customerId: string; name: string }) {
  return (
    <DeleteRecord
      label="Delete customer"
      title={`Delete ${name}?`}
      description="For a customer made as a test: they go for good, with their bookings, and their bags or freight still waiting are cancelled. Someone who flew, has an invoice, or has a booking still on a flight stays on record."
      action={() => deleteCustomerAction(customerId)}
      redirectTo="/customers"
    />
  );
}
