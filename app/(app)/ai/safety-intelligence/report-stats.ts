import type { HazardStatus } from "@/lib/api/safety";

/**
 * The arithmetic half of Safety Intelligence.
 *
 * Split out from the page so it can be tested directly. These numbers
 * are the ones a safety officer will quote in a meeting — they are
 * counts of their own reports, not a model's reading of them, and they
 * have to be exactly right.
 */

/** The fields both report kinds share, as a shape rather than an
 *  intersection: `Pick<HazardReport & Incident, …>` narrows `category`
 *  to the categories the two unions have in common, which silently
 *  drops the incident-only ones (`wildlife` among them). */
export interface Report {
  category: string;
  status: HazardStatus;
  created_at: string;
  station: { icao_code: string } | null;
  location_free_text: string | null;
}

export function withinWindow(created: string, since: Date): boolean {
  const t = Date.parse(created);
  return Number.isFinite(t) && t >= since.getTime();
}

/**
 * Open is everything not yet closed — submitted, triaged, in_progress.
 *
 * There is no "open" status. Writing `status === "open"` produced a
 * filter that matched nothing and rendered a confident zero, which is
 * the worst way for this number to be wrong: a safety officer reading
 * "0 open" stops looking. TypeScript caught it; the assertion below
 * keeps it caught.
 */
export function openCount(reports: Report[]): number {
  return reports.filter((r) => r.status !== "closed").length;
}

/** Count by key, largest first. Rows with no key are skipped rather
 *  than bucketed under a blank label. */
export function tally(
  reports: Report[],
  key: (r: Report) => string | null,
): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const r of reports) {
    const k = key(r);
    if (!k) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

/** A station's ICAO if the report has one, else whatever the reporter
 *  typed. Station first: it is the canonical name for the same place,
 *  so "PANC" and "anchorage" do not become two rows. */
export function locationOf(r: Report): string | null {
  return r.station?.icao_code ?? r.location_free_text ?? null;
}

export function humanise(value: string): string {
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
