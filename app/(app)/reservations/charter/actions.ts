"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import {
  CHARTER_STATUSES,
  type CharterStatus,
  createCharter,
  transitionCharter,
} from "@/lib/api/charter";

export type CharterActionState = {
  status: "idle" | "ok" | "error";
  message?: string;
};

export async function createCharterAction(
  _prev: CharterActionState,
  form: FormData,
): Promise<CharterActionState> {
  const customer_id = String(form.get("customer_id") ?? "").trim();
  const origin_icao = String(form.get("origin_icao") ?? "").trim().toUpperCase();
  const destination_icao = String(form.get("destination_icao") ?? "")
    .trim()
    .toUpperCase();
  const requested_date = String(form.get("requested_date") ?? "").trim();
  const requested_time = String(form.get("requested_time") ?? "").trim();
  const return_date = String(form.get("return_date") ?? "").trim();
  const pax_count_raw = String(form.get("pax_count") ?? "").trim();
  const aircraft_type_requested = String(
    form.get("aircraft_type_requested") ?? "",
  ).trim();
  const notes = String(form.get("notes") ?? "").trim();

  if (!customer_id) return { status: "error", message: "Pick a customer." };
  if (origin_icao.length < 3 || origin_icao.length > 10) {
    return { status: "error", message: "Origin ICAO looks wrong." };
  }
  if (destination_icao.length < 3 || destination_icao.length > 10) {
    return { status: "error", message: "Destination ICAO looks wrong." };
  }
  if (!requested_date) {
    return { status: "error", message: "Pick a requested date." };
  }
  const pax = pax_count_raw ? parseInt(pax_count_raw, 10) : 1;
  if (!Number.isFinite(pax) || pax < 1) {
    return { status: "error", message: "Passenger count must be at least 1." };
  }

  try {
    await createCharter({
      customer_id,
      origin_icao,
      destination_icao,
      requested_date,
      requested_time: requested_time || undefined,
      return_date: return_date || undefined,
      pax_count: pax,
      aircraft_type_requested: aircraft_type_requested || undefined,
      notes: notes || undefined,
    });
    revalidatePath("/reservations/charter");
    return { status: "ok", message: "Charter request filed." };
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

export async function transitionCharterAction(
  charterId: string,
  toStatus: CharterStatus,
): Promise<CharterActionState> {
  if (!(CHARTER_STATUSES as readonly string[]).includes(toStatus)) {
    return { status: "error", message: "Unknown status." };
  }
  try {
    await transitionCharter(charterId, toStatus);
    revalidatePath("/reservations/charter");
    return { status: "ok" };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 409) {
        return { status: "error", message: "That transition isn't allowed." };
      }
      return { status: "error", message: `Backend error ${err.status}` };
    }
    return { status: "error", message: "Unexpected error." };
  }
}
