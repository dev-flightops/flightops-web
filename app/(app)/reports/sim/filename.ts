import type { SimBasis, SimFormat } from "@/lib/api/reports";

/**
 * The name the browser saves the export under.
 *
 * Its own module rather than living in `actions.ts`, because that file
 * is `"use server"` and pulls in `lib/api/client` — and therefore
 * next-auth — which cannot load under vitest. A pure function that
 * both the action and its test can import needs no server at all.
 *
 * Two construction sites for one filename is a drift risk, and it is
 * deliberate: `apiFetch` parses the body and does not surface response
 * headers, so the Content-Disposition name reports-service sends cannot
 * be read here. The scheme is carrier, basis, both dates, extension,
 * in both places.
 *
 * Legacy's is `GV_SIM_{start}_{end}.{ext}` with the carrier hardcoded
 * and no basis — so its OAG schedule and its accounting extract saved
 * to the same name and overwrote each other in the downloads folder.
 */

const EXTENSION: Record<SimFormat, string> = {
  csv: "csv",
  fixed: "sim",
  xml: "xml",
};

export function simFilename(
  carrier: string,
  basis: SimBasis,
  start: string,
  end: string,
  format: SimFormat,
): string {
  return `${carrier}_${basis}_${start}_${end}.${EXTENSION[format]}`;
}
