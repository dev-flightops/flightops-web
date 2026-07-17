"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { type IncidentStatus, patchIncident } from "@/lib/api/safety";

export interface IncidentTriageState {
  status: "idle" | "error" | "ok";
  message?: string;
}

export async function triageIncidentAction(
  _prev: IncidentTriageState,
  formData: FormData,
): Promise<IncidentTriageState> {
  const incidentId = String(formData.get("incident_id") ?? "");
  const nextStatus = String(formData.get("next_status") ?? "") as IncidentStatus;
  const closedReason = String(formData.get("closed_reason") ?? "").trim();

  if (!incidentId || !nextStatus) {
    return { status: "error", message: "Missing incident id or status." };
  }
  if (nextStatus === "closed" && !closedReason) {
    return {
      status: "error",
      message: "A closure reason is required to close an incident.",
    };
  }

  try {
    await patchIncident(incidentId, {
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

  revalidatePath(`/safety/incidents/${incidentId}`);
  revalidatePath("/safety/incidents");
  return { status: "ok" };
}
