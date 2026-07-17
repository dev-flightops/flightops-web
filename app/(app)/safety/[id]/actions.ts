"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { type HazardStatus, patchHazard } from "@/lib/api/safety";

export interface TriageActionState {
  status: "idle" | "error" | "ok";
  message?: string;
}

export async function triageHazardAction(
  _prev: TriageActionState,
  formData: FormData,
): Promise<TriageActionState> {
  const hazardId = String(formData.get("hazard_id") ?? "");
  const nextStatus = String(formData.get("next_status") ?? "") as HazardStatus;
  const closedReason = String(formData.get("closed_reason") ?? "").trim();

  if (!hazardId) {
    return { status: "error", message: "Missing hazard id." };
  }
  if (!nextStatus) {
    return { status: "error", message: "Missing target status." };
  }
  if (nextStatus === "closed" && !closedReason) {
    return {
      status: "error",
      message: "A closure reason is required to close a hazard.",
    };
  }

  try {
    await patchHazard(hazardId, {
      status: nextStatus,
      closed_reason: nextStatus === "closed" ? closedReason : null,
    });
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
      message: "Could not reach safety-service. Try again in a moment.",
    };
  }

  revalidatePath(`/safety/${hazardId}`);
  revalidatePath("/safety");
  return { status: "ok" };
}
