"use server";

import { ApiError, SessionExpiredError } from "@/lib/api/client";
import type { CsvResult } from "@/components/reports/filing-controls";
import {
  getCamCsv,
  getDot41Csv,
  getForm5394Csv,
  getPS5500Csv,
  getT100Csv,
} from "@/lib/api/reports";

/**
 * Fetching the filing CSVs, from the server.
 *
 * The export button is a client component and these all go through
 * `apiFetch`, which starts with `await auth()` — server only. A client
 * component importing one throws on every call, which is how the New
 * Booking search stayed broken for weeks;
 * `lib/api/client-boundary.test.ts` now fails the build for crossing
 * that line.
 *
 * One error shape for all five: the button only ever needs to say why
 * nothing downloaded.
 */

async function attempt(fetch: () => Promise<string>): Promise<CsvResult> {
  try {
    return { status: "ok", csv: await fetch() };
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

export async function downloadT100CsvAction(
  year: number,
  month: number,
): Promise<CsvResult> {
  return attempt(() => getT100Csv(year, month));
}

export async function downloadPS5500CsvAction(
  year: number,
  month: number,
): Promise<CsvResult> {
  return attempt(() => getPS5500Csv(year, month));
}

export async function downloadCamCsvAction(
  year: number,
  month: number,
): Promise<CsvResult> {
  return attempt(() => getCamCsv(year, month));
}

export async function downloadForm5394CsvAction(
  year: number,
  month: number,
): Promise<CsvResult> {
  return attempt(() => getForm5394Csv(year, month));
}

export async function downloadDot41CsvAction(
  year: number,
  quarter: number,
): Promise<CsvResult> {
  return attempt(() => getDot41Csv(year, quarter));
}
