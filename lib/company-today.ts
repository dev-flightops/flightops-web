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
  let table = DEFAULT_ZONE_TABLE;
  try {
    table = await loadZoneTable();
  } catch {
    // Alaska's, the default, when the company's bases can't be read.
  }
  return localDay(table.fallback, at);
}
