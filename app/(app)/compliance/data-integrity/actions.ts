"use server";

import { revalidatePath } from "next/cache";

import { ApiError, SessionExpiredError } from "@/lib/api/client";
import { postIntegrityAttestation } from "@/lib/api/reports";

/**
 * Recording a review, from the server.
 *
 * The 409 gets its own message. Every other failure is a request that
 * went wrong; that one is a request that was right when the page
 * loaded and is no longer, and the reviewer needs to know it is the
 * figures that moved rather than the button that broke.
 */

export type AttestResult =
  | { status: "ok" }
  | { status: "stale"; message: string }
  | { status: "error"; message: string };

export async function attestAction(
  findingsHash: string,
  notes: string,
): Promise<AttestResult> {
  try {
    await postIntegrityAttestation(findingsHash, notes);
    revalidatePath("/compliance/data-integrity");
    return { status: "ok" };
  } catch (err) {
    if (err instanceof SessionExpiredError) {
      return {
        status: "error",
        message: "Your session has expired. Sign in again to record the review.",
      };
    }
    if (err instanceof ApiError && err.status === 409) {
      return {
        status: "stale",
        message:
          "The findings changed while this page was open. Reload and read the current figures before signing — an attestation has to name the figures it was given.",
      };
    }
    if (err instanceof ApiError && err.status === 422) {
      return {
        status: "error",
        message:
          "Say what you reviewed and what you did about it. This record is the operator's evidence that the review happened.",
      };
    }
    if (err instanceof ApiError && err.status === 403) {
      return {
        status: "error",
        message:
          "Only the Director of Operations or an executive admin can sign this review.",
      };
    }
    if (err instanceof ApiError) {
      return {
        status: "error",
        message: `The review was not recorded (HTTP ${err.status}).`,
      };
    }
    return { status: "error", message: "Could not reach reports-service." };
  }
}
