"use server";

import { ApiError, SessionExpiredError } from "@/lib/api/client";
import { getT100Csv } from "@/lib/api/reports";

/**
 * Fetching the CSV, from the server.
 *
 * The download button is a client component and `getT100Csv` goes
 * through `apiFetch`, which starts with `await auth()` — server only.
 * `lib/api/client-boundary.test.ts` fails the build for crossing that
 * line, which is how the New Booking search stayed broken for weeks.
 */
export type CsvResult =
  | { status: "ok"; csv: string }
  | { status: "error"; message: string };

export async function downloadT100CsvAction(
  year: number,
  month: number,
): Promise<CsvResult> {
  try {
    return { status: "ok", csv: await getT100Csv(year, month) };
  } catch (err) {
    if (err instanceof SessionExpiredError) {
      return {
        status: "error",
        message: "Your session has expired. Sign in again to download.",
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
