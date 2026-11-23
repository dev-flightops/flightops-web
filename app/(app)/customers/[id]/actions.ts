"use server";

import { revalidatePath } from "next/cache";
import { deleteCustomer } from "@/lib/api/reservations";
import { type DeleteResult, deleteRefusal } from "@/lib/records/delete-refusal";

/** Delete a test customer and their bookings (1119-30). */
export async function deleteCustomerAction(customerId: string): Promise<DeleteResult> {
  try {
    await deleteCustomer(customerId);
  } catch (err) {
    return { ok: false, message: deleteRefusal(err, "customer") };
  }
  revalidatePath("/customers");
  revalidatePath("/reservations");
  return { ok: true };
}
