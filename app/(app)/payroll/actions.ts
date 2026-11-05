"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { refusalText } from "@/lib/api/validation-errors";
import {
  approvePayEvent,
  approvePendingPayEvents,
  createPayEvent,
  generatePayEvents,
  PAY_EVENT_TYPES,
  type PayEventType,
} from "@/lib/api/payroll";

export type PayEventActionState = {
  status: "idle" | "ok" | "error";
  message?: string;
};

export async function approvePayEventAction(
  eventId: string,
  action: "approve" | "reject",
): Promise<PayEventActionState> {
  try {
    await approvePayEvent(eventId, action);
    revalidatePath("/payroll");
    return {
      status: "ok",
      message: action === "approve" ? "Approved" : "Rejected",
    };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 409) {
        return {
          status: "error",
          message: "Exported events cannot be modified.",
        };
      }
      if (err.status === 404) {
        return { status: "error", message: "Pay event not found." };
      }
      return { status: "error", message: `Error ${err.status}` };
    }
    return { status: "error", message: "Unexpected error." };
  }
}

function rangeRefusal(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Your session expired. Sign in again, then retry.";
    if (err.status === 403) return "Only an Exec Admin can do that.";
    if (err.message.includes("range_too_long")) {
      return "That's too long a range: 92 days at a time.";
    }
    if (err.message.includes("end_before_start")) {
      return "The end date is before the start date.";
    }
    return `That didn't work (HTTP ${err.status}).`;
  }
  return "Could not reach the server. Try again in a moment.";
}

/** Make or correct the events for everything flown or clocked in the range. */
export async function generatePayEventsAction(
  start: string,
  end: string,
): Promise<PayEventActionState> {
  try {
    const { created, updated, removed } = await generatePayEvents(start, end);
    revalidatePath("/payroll");
    revalidatePath("/payroll/periods");
    const changes = [
      created ? `${created} created` : null,
      updated ? `${updated} updated` : null,
      removed ? `${removed} removed` : null,
    ].filter(Boolean);
    return {
      status: "ok",
      message: changes.length ? `${changes.join(", ")}.` : "Already up to date.",
    };
  } catch (err) {
    return { status: "error", message: rangeRefusal(err) };
  }
}

export async function approvePendingPayEventsAction(
  start: string,
  end: string,
): Promise<PayEventActionState> {
  try {
    const { approved, left_to_check } = await approvePendingPayEvents(start, end);
    revalidatePath("/payroll");
    revalidatePath("/payroll/periods");
    const left = left_to_check
      ? ` ${left_to_check} left for you to check.`
      : "";
    return { status: "ok", message: `Approved ${approved}.${left}` };
  } catch (err) {
    return { status: "error", message: rangeRefusal(err) };
  }
}

export async function createPayEventAction(
  _prev: PayEventActionState,
  form: FormData,
): Promise<PayEventActionState> {
  const employee = String(form.get("employee_user_id") ?? "").trim();
  const eventType = String(form.get("event_type") ?? "").trim();
  const hours = String(form.get("hours") ?? "").trim();
  const amount = String(form.get("amount") ?? "").trim();
  const eventDate = String(form.get("event_date") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const notes = String(form.get("notes") ?? "").trim();

  if (!employee) {
    return { status: "error", message: "Please pick an employee." };
  }
  if (!(PAY_EVENT_TYPES as readonly string[]).includes(eventType)) {
    return { status: "error", message: "Please pick an event type." };
  }
  if (!eventDate) {
    return { status: "error", message: "Please pick an event date." };
  }
  if (!hours && !amount) {
    return {
      status: "error",
      message: "Enter Hours or Amount (or both).",
    };
  }
  try {
    await createPayEvent({
      employee_user_id: employee,
      event_type: eventType as PayEventType,
      hours: hours || undefined,
      amount: amount || undefined,
      event_date: eventDate,
      description: description || undefined,
      notes: notes || undefined,
    });
    revalidatePath("/payroll");
    return { status: "ok", message: "Pay event created." };
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        status: "error",
        message: refusalText(err) ?? `That didn't go through (HTTP ${err.status}). Try again in a moment.`,
      };
    }
    return { status: "error", message: "Unexpected error." };
  }
}
