"use server";

import {
  getHousingUnit,
  listHousingBookings,
  listHousingUnits,
} from "@/lib/api/housing";
import {
  costByEmployee,
  costCsv,
  employeeHistory,
  historyCsv,
  occupancyByUnit,
  occupancyCsv,
} from "@/lib/housing/reports";

export type ExportResult =
  | { ok: true; csv: string }
  | { ok: false; error: string };

/**
 * Build one of the three housing reports as CSV.
 *
 * Re-fetches and re-computes rather than accepting rows from the
 * client: what gets exported has to be what the server would render
 * for that range, not whatever a client sent back.
 */
export async function exportHousingReportAction(
  tab: "occupancy" | "history" | "cost",
  from: string,
  to: string,
): Promise<ExportResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return { ok: false, error: "Pick a start and end date first." };
  }
  if (from > to) {
    return { ok: false, error: "The start date is after the end date." };
  }
  try {
    const [unitsResp, bookingsResp] = await Promise.all([
      listHousingUnits(),
      listHousingBookings({ from, to, includeCancelled: true }),
    ]);
    const units = unitsResp.items;
    const details = await Promise.all(
      units.map((u) => getHousingUnit(u.id).catch(() => null)),
    );
    const rooms = details.flatMap((d) => d?.rooms ?? []);
    const bookings = bookingsResp.items;

    const csv =
      tab === "occupancy"
        ? occupancyCsv(occupancyByUnit(units, rooms, bookings, from, to))
        : tab === "history"
          ? historyCsv(employeeHistory(bookings, rooms))
          : costCsv(costByEmployee(bookings, rooms, from, to));
    return { ok: true, csv };
  } catch {
    return { ok: false, error: "Couldn't build the report. Try again." };
  }
}
