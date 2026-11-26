import { loadZoneTable } from "@/lib/api/auth";
import { DEFAULT_ZONE_TABLE, localDay } from "@/lib/format/local-time";

/**
 * The company's date, "2026-11-30": in the zone of its first base, else
 * Alaska's. Not `new Date().toISOString().slice(0, 10)`, which is UTC's:
 * from 3 or 4 pm Alaska time that is already tomorrow, so a check logged in
 * the evening took tomorrow's date and an invoice due today read overdue
 * (code audit, 26 Nov). Server-side: it reads the company's bases.
 */
export async function companyToday(at: Date = new Date()): Promise<string> {
  return localDay(await companyZone(), at);
}

/** The company's zone, for a client form's "today": its first base's, else
 *  Alaska's. Server-side, as companyToday. */
export async function companyZone(): Promise<string> {
  try {
    return (await loadZoneTable()).fallback;
  } catch {
    // Alaska's, the default, when the company's bases can't be read.
    return DEFAULT_ZONE_TABLE.fallback;
  }
}
