"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import {
  approvePayEvent,
  createPayEvent,
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
        message: `Backend error ${err.status}: ${err.message}`,
      };
    }
    return { status: "error", message: "Unexpected error." };
  }
}
