import type { FaaRunway } from "@/lib/api/ground";

/** "01/19 · 3,284 × 60 ft · 26° true". */
export function runwayFigures(runway: FaaRunway): string {
  const size = `${runway.length_ft.toLocaleString("en-US")} × ${runway.width_ft} ft`;
  const heading = runway.true_alignment_deg === null ? "no heading on file" : `${runway.true_alignment_deg}° true`;
  return `${runway.name} · ${size} · ${heading}`;
}

/** "29 Oct 2026" from "2026-10-29". */
export function formatFaaDate(effective: string): string {
  const date = new Date(`${effective}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return effective;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
