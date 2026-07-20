"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import {
  cancelBooking,
  completeBooking,
  confirmBooking,
  quoteBooking,
} from "@/lib/api/reservations";

export interface LifecycleState {
  status: "idle" | "error" | "ok";
  message?: string;
}

async function _wrap(
  bookingId: string,
  op: () => Promise<unknown>,
): Promise<LifecycleState> {
  try {
    await op();
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 409) {
        return {
          status: "error",
          message: `Backend rejected the transition (${err.message}).`,
        };
      }
      return {
        status: "error",
        message: `Backend returned HTTP ${err.status}.`,
      };
    }
    return {
      status: "error",
      message: "Could not reach reservations-service.",
    };
  }
  revalidatePath(`/reservations/bookings/${bookingId}`);
  revalidatePath("/reservations");
  return { status: "ok" };
}

export async function quoteAction(
  _prev: LifecycleState,
  formData: FormData,
): Promise<LifecycleState> {
  const bookingId = String(formData.get("booking_id") ?? "");
  const dollars = Number(formData.get("quoted_total_dollars") ?? 0);
  if (!bookingId) return { status: "error", message: "Missing booking id." };
  if (!Number.isFinite(dollars) || dollars < 0) {
    return { status: "error", message: "Quote must be a non-negative number." };
  }
  return _wrap(bookingId, () =>
    quoteBooking(bookingId, Math.round(dollars * 100)),
  );
}

export async function confirmAction(
  _prev: LifecycleState,
  formData: FormData,
): Promise<LifecycleState> {
  const bookingId = String(formData.get("booking_id") ?? "");
  if (!bookingId) return { status: "error", message: "Missing booking id." };
  return _wrap(bookingId, () => confirmBooking(bookingId));
}

export async function completeAction(
  _prev: LifecycleState,
  formData: FormData,
): Promise<LifecycleState> {
  const bookingId = String(formData.get("booking_id") ?? "");
  if (!bookingId) return { status: "error", message: "Missing booking id." };
  return _wrap(bookingId, () => completeBooking(bookingId));
}

export async function cancelAction(
  _prev: LifecycleState,
  formData: FormData,
): Promise<LifecycleState> {
  const bookingId = String(formData.get("booking_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!bookingId) return { status: "error", message: "Missing booking id." };
  if (!reason) {
    return {
      status: "error",
      message: "A cancellation reason is required.",
    };
  }
  return _wrap(bookingId, () => cancelBooking(bookingId, reason));
}
