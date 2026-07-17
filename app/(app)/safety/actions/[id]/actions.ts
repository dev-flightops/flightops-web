"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { type CapaStatus, updateCapaNotes, updateCapaStatus } from "@/lib/api/safety";

// ---- Owner notes ------------------------------------------------------------

export interface NotesFormState {
  status: "idle" | "error" | "ok";
  message?: string;
}

export async function updateNotesAction(
  _prev: NotesFormState,
  formData: FormData,
): Promise<NotesFormState> {
  const capaId = String(formData.get("capa_id") ?? "");
  const notes = String(formData.get("notes") ?? "");
  if (!capaId) return { status: "error", message: "Missing CAPA id." };

  try {
    await updateCapaNotes(capaId, notes);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 403) {
        return {
          status: "error",
          message: "You're not the owner of this corrective action.",
        };
      }
      if (err.status === 409) {
        return {
          status: "error",
          message: "This corrective action is closed — notes are read-only.",
        };
      }
      return {
        status: "error",
        message: `Backend returned HTTP ${err.status}.`,
      };
    }
    return { status: "error", message: "Could not reach safety-service." };
  }
  revalidatePath(`/safety/actions/${capaId}`);
  return { status: "ok" };
}

// ---- Status transition ------------------------------------------------------

export interface StatusFormState {
  status: "idle" | "error" | "ok";
  message?: string;
}

export async function updateStatusAction(
  _prev: StatusFormState,
  formData: FormData,
): Promise<StatusFormState> {
  const capaId = String(formData.get("capa_id") ?? "");
  const nextStatus = String(formData.get("next_status") ?? "") as CapaStatus;
  const closedReason = String(formData.get("closed_reason") ?? "").trim();

  if (!capaId || !nextStatus) {
    return { status: "error", message: "Missing CAPA id or status." };
  }
  if (nextStatus === "closed" && !closedReason) {
    return {
      status: "error",
      message: "A closure reason is required to close a corrective action.",
    };
  }

  try {
    await updateCapaStatus(capaId, {
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
    return { status: "error", message: "Could not reach safety-service." };
  }
  revalidatePath(`/safety/actions/${capaId}`);
  revalidatePath("/safety/actions");
  return { status: "ok" };
}
