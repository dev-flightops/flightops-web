"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import {
  createPayPeriod,
  exportPayPeriodCsv,
  lockPayPeriod,
} from "@/lib/api/payroll";

export type PeriodActionState = {
  status: "idle" | "ok" | "error";
  message?: string;
};

export async function createPeriodAction(
  _prev: PeriodActionState,
  form: FormData,
): Promise<PeriodActionState> {
  const start = String(form.get("period_start") ?? "").trim();
  const end = String(form.get("period_end") ?? "").trim();
  const notes = String(form.get("notes") ?? "").trim();

  if (!start || !end) {
    return { status: "error", message: "Enter both start and end dates." };
  }
  if (end <= start) {
    return {
      status: "error",
      message: "Period end must be after period start.",
    };
  }
  try {
    await createPayPeriod({
      period_start: start,
      period_end: end,
      notes: notes || undefined,
    });
    revalidatePath("/payroll/periods");
    return { status: "ok", message: "Pay period created." };
  } catch (err) {
    if (err instanceof ApiError) {
      return { status: "error", message: `Backend ${err.status}: ${err.message}` };
    }
    return { status: "error", message: "Unexpected error." };
  }
}

export async function lockPeriodAction(
  periodId: string,
): Promise<PeriodActionState> {
  try {
    await lockPayPeriod(periodId);
    revalidatePath("/payroll/periods");
    return { status: "ok", message: "Locked." };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 409) {
        return {
          status: "error",
          message: "Exported periods cannot be re-locked.",
        };
      }
      return { status: "error", message: `Backend ${err.status}` };
    }
    return { status: "error", message: "Unexpected error." };
  }
}

/**
 * Export the period as CSV. Server action fetches the raw CSV
 * text from the auth-service and returns it to the caller — the
 * client-side button turns it into a browser download.
 */
export async function exportPeriodAction(
  periodId: string,
): Promise<{ ok: true; csv: string; filename: string } | PeriodActionState> {
  try {
    const csv = await exportPayPeriodCsv(periodId);
    revalidatePath("/payroll/periods");
    return {
      ok: true,
      csv,
      filename: `payroll_${periodId.slice(0, 8)}.csv`,
    };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 409) {
        return {
          status: "error",
          message: "Period must be locked before export.",
        };
      }
      return { status: "error", message: `Backend ${err.status}` };
    }
    return { status: "error", message: "Unexpected error." };
  }
}
