import Link from "next/link";

import type { CrewOption } from "@/lib/api/ops";

/** The first two reasons and how many more: a pilot with every record
 *  still to enter has a dozen, and the record lists them all. */
function summary(reasons: string[]): string {
  if (reasons.length <= 2) return reasons.join("; ");
  return `${reasons.slice(0, 2).join("; ")}; and ${reasons.length - 2} more`;
}

/**
 * The pilots a seat doesn't offer, and why (#91). The client, 21 Oct: "The
 * pilot with records out of compliance should be invisible to dispatchers."
 * Decided 26 Oct: not offered, and listed here, collapsed, so dispatch
 * knows why someone is missing.
 */
export function NotAvailableList({ seat, options }: { seat: string; options: CrewOption[] }) {
  const out = options.filter((o) => !o.available);
  if (out.length === 0) return null;
  return (
    <details className="mt-1.5 text-[0.68rem]">
      <summary className="cursor-pointer text-muted-foreground">
        {`Not available as ${seat} (${out.length})`}
      </summary>
      <ul className="mt-1 space-y-1">
        {out.map((o) => (
          <li key={o.pilot.id}>
            <Link
              href={`/compliance/pilots/${o.pilot.id}`}
              className="font-semibold text-foreground hover:underline"
            >
              {o.pilot.full_name}
            </Link>
            <span className="text-muted-foreground">{` — ${summary(o.reasons)}`}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** The ids a seat doesn't offer; empty when the options couldn't be read,
 *  and then every pilot is offered as before, with release still checking. */
export function unavailableIds(options: CrewOption[] | null | undefined): Set<string> {
  return new Set((options ?? []).filter((o) => !o.available).map((o) => o.pilot.id));
}

/** "Not available for this flight: Day Landing Currency 0/3 …" for a pilot
 *  release would refuse in the seat, else null. Shown in place of the
 *  pilot's overall status: "Fully current" reads their records across the
 *  board, which leave out what binds only this flight, landings with
 *  passengers aboard among them. The packet showed "Fully current · not
 *  available" beside its HARD BLOCK. */
export function unavailableLabel(
  options: CrewOption[] | null | undefined,
  pilotId: string | null | undefined,
): string | null {
  const option = (options ?? []).find((o) => o.pilot.id === pilotId && !o.available);
  if (!option) return null;
  return option.reasons.length > 0
    ? `Not available for this flight: ${summary(option.reasons)}`
    : "Not available for this flight";
}
