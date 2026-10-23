"use server";

import { revalidatePath } from "next/cache";

import {
  createCheckInField,
  updateCheckInConfig,
  updateCheckInField,
  type CheckInConfigUpdate,
  type CheckInCustomFieldInput,
} from "@/lib/api/check-in";
import { ApiError, SessionExpiredError } from "@/lib/api/client";

/**
 * Settings → Check-in (#103): ground's /checkin/config and its custom
 * fields, which the Chief Pilot, the DO or an Exec Admin set (legacy's
 * CONFIG_ROLES). Called directly from the client component.
 */

export type SettingsResult = { ok: true } | { ok: false; error: string };

function failed(err: unknown, what: string): SettingsResult {
  if (err instanceof SessionExpiredError) {
    return { ok: false, error: "Your session expired — please sign in again." };
  }
  if (err instanceof ApiError) {
    if (err.status === 403) {
      return { ok: false, error: "Only the Chief Pilot, the DO or an Exec Admin can change this." };
    }
    if (err.status === 409) {
      return { ok: false, error: "A field with that key already exists." };
    }
    return { ok: false, error: `${what} wasn't saved (HTTP ${err.status}).` };
  }
  return { ok: false, error: `${what} wasn't saved. Try again.` };
}

function refresh() {
  revalidatePath("/settings/check-in");
}

export async function saveCheckInRulesAction(patch: CheckInConfigUpdate): Promise<SettingsResult> {
  if (patch.no_show_fee_amount != null && !(patch.no_show_fee_amount >= 0)) {
    return { ok: false, error: "The no-show fee can't be negative." };
  }
  try {
    await updateCheckInConfig(patch);
  } catch (err) {
    return failed(err, "The check-in settings");
  }
  refresh();
  return { ok: true };
}

export async function addCheckInFieldAction(input: CheckInCustomFieldInput): Promise<SettingsResult> {
  const key = input.field_key.trim().toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(key)) {
    return { ok: false, error: "The key takes letters, numbers, dashes and underscores only." };
  }
  if (input.field_type === "dropdown" && !(input.field_options ?? "").trim()) {
    return { ok: false, error: "A dropdown needs its options, one per line." };
  }
  try {
    await createCheckInField({ ...input, field_key: key });
  } catch (err) {
    return failed(err, "The field");
  }
  refresh();
  return { ok: true };
}

export async function setCheckInFieldAction(
  id: string,
  patch: { is_active?: boolean; is_required?: boolean },
): Promise<SettingsResult> {
  try {
    await updateCheckInField(id, patch);
  } catch (err) {
    return failed(err, "The field");
  }
  refresh();
  return { ok: true };
}
