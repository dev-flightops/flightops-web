"use server";

import { revalidatePath } from "next/cache";

import {
  createPayModifier,
  createPayRate,
  deletePayModifier,
  deletePayRate,
  type PayModifierInput,
  type PayRateInput,
} from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

export interface PayFormState {
  status: "idle" | "ok" | "error";
  message?: string;
  attempt: number;
}

const RATE_TYPES: readonly string[] = ["daily", "flight_hourly"];
const MODIFIER_TYPES: readonly string[] = ["flat", "multiplier", "per_hour"];

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

/** The money typed, without its $ and commas; null when it isn't a number. */
function money(raw: string): string | null {
  const cleaned = raw.replace(/[$,]/g, "");
  return cleaned !== "" && Number.isFinite(Number(cleaned)) ? cleaned : null;
}

function whole(raw: string): number | null | undefined {
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
}

function why(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Your session expired. Sign in again, then retry.";
    if (err.status === 403) return "Only an Exec Admin can change pilot pay.";
    if (err.message.includes("yos_min_gt_max")) return "YOS Min can't be more than YOS Max.";
    if (err.message.includes("end_before_effective")) return "The end date can't be before the effective date.";
    if (err.status === 404) return "That row is already gone. Refresh the page.";
    return `That was not saved (HTTP ${err.status}).`;
  }
  return "Could not reach the server. Try again in a moment.";
}

/**
 * Add a pay rate. Rates aren't edited, as in legacy: a new row with a later
 * effective date takes over from the old one.
 */
export async function addPayRateAction(prev: PayFormState, formData: FormData): Promise<PayFormState> {
  const attempt = prev.attempt + 1;
  const fail = (message: string): PayFormState => ({ status: "error", message, attempt });

  const rateType = text(formData, "rate_type");
  if (!RATE_TYPES.includes(rateType)) return fail("Pick the type of rate.");
  const amount = money(text(formData, "rate_amount"));
  if (amount === null || Number(amount) <= 0) return fail("Enter a rate above $0.");
  const effective = text(formData, "effective_date");
  if (!effective) return fail("Enter the date the rate takes effect.");
  const min = whole(text(formData, "year_of_service_min"));
  const max = whole(text(formData, "year_of_service_max"));
  if (min === undefined || max === undefined) return fail("Years of service are whole numbers, 0 or more.");

  const body: PayRateInput = {
    rate_type: rateType as PayRateInput["rate_type"],
    crew_member_id: text(formData, "crew_member_id") || null,
    airframe_type: text(formData, "airframe_type") || null,
    year_of_service_min: min,
    year_of_service_max: max,
    rate_amount: amount,
    effective_date: effective,
    end_date: text(formData, "end_date") || null,
  };
  try {
    await createPayRate(body);
  } catch (err) {
    return fail(why(err));
  }
  revalidatePath("/settings/pilot-pay");
  return { status: "ok", message: "Rate added.", attempt };
}

export async function addPayModifierAction(prev: PayFormState, formData: FormData): Promise<PayFormState> {
  const attempt = prev.attempt + 1;
  const fail = (message: string): PayFormState => ({ status: "error", message, attempt });

  const name = text(formData, "modifier_name");
  if (!name) return fail("Pick the modifier.");
  const label = text(formData, "display_label");
  if (!label) return fail("Enter the label people will see.");
  if (label.length > 80) return fail("Keep the label under 80 characters.");
  const type = text(formData, "modifier_type");
  if (!MODIFIER_TYPES.includes(type)) return fail("Pick the type of modifier.");
  const value = money(text(formData, "modifier_value"));
  if (value === null) return fail("Enter the modifier's value as a number.");

  try {
    await createPayModifier({
      modifier_name: name,
      display_label: label,
      modifier_type: type as PayModifierInput["modifier_type"],
      modifier_value: value,
    });
  } catch (err) {
    return fail(why(err));
  }
  revalidatePath("/settings/pilot-pay");
  return { status: "ok", message: `Added ${label}.`, attempt };
}

export async function removePayRateAction(rowId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await deletePayRate(rowId);
  } catch (err) {
    return { ok: false, error: why(err) };
  }
  revalidatePath("/settings/pilot-pay");
  return { ok: true };
}

export async function removePayModifierAction(rowId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await deletePayModifier(rowId);
  } catch (err) {
    return { ok: false, error: why(err) };
  }
  revalidatePath("/settings/pilot-pay");
  return { ok: true };
}
