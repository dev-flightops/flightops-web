"use server";

import type { FileResult } from "@/app/(app)/reports/sim/export-controls";
import { ApiError, SessionExpiredError } from "@/lib/api/client";
import {
  getSimFile,
  type SimBasis,
  type SimFormat,
} from "@/lib/api/reports";

import { simFilename } from "./filename";

/**
 * Fetching the export file, from the server.
 *
 * Same boundary as the regulatory filings: `apiFetch` begins with
 * `await auth()`, so the button cannot call it and the action is passed
 * down as a prop.
 *
 * The 409 gets its own message. Every other failure is a fetch that
 * went wrong; that one is a configuration gap with a specific fix, and
 * telling somebody "the export was refused (HTTP 409)" when the answer
 * is "set your carrier code" wastes the one thing the error knew.
 */

export async function downloadSimFileAction(
  carrier: string,
  start: string,
  end: string,
  basis: SimBasis,
  format: SimFormat,
): Promise<FileResult> {
  try {
    return {
      status: "ok",
      body: await getSimFile(start, end, basis, format),
      filename: simFilename(carrier, basis, start, end, format),
    };
  } catch (err) {
    if (err instanceof SessionExpiredError) {
      return {
        status: "error",
        message: "Your session has expired. Sign in again to download.",
      };
    }
    if (err instanceof ApiError && err.status === 409) {
      return {
        status: "error",
        message:
          "No carrier code is set for this operator. Set it on Settings → Company Profile.",
      };
    }
    if (err instanceof ApiError) {
      return {
        status: "error",
        message: `The export was refused (HTTP ${err.status}).`,
      };
    }
    return { status: "error", message: "Could not reach reports-service." };
  }
}
