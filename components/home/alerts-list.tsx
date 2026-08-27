import Link from "next/link";

import type { OperationalAlert } from "@/lib/dashboards/operational-snapshot";

/**
 * Presentational half of the Active Alerts panel.
 *
 * Split from active-alerts-panel.tsx purely so it can be rendered in a
 * test. That file calls loadOperationalSnapshot(), which reaches
 * lib/api/* -> apiFetch -> next-auth -> next/server, and next/server
 * does not resolve under vitest. Importing only the TYPE here keeps the
 * chain out of the test environment.
 *
 * Fourth time this has bitten in this repo, after release-errors.ts,
 * portal-ui.tsx and flight-results.tsx. The rule that keeps emerging:
 * a component that renders data should import types from lib/, never
 * the functions that fetch it — take the data as props and let a server
 * component do the fetching.
 *
 * STYLING
 *
 * Lives on the white Home page, not inside the dark app shell, so it
 * uses the same explicit light palette as the Departments section below
 * it (neutral text, black/10 hairlines) rather than the bg-card /
 * border-border tokens, which resolve dark and made the panel read as a
 * black slab dropped into a white page.
 *
 * Nobody caught that because the panel was gated on role names that do
 * not exist, so no admin ever saw it in place. The gate was fixed first;
 * this is the half that only became visible afterwards.
 *
 * GROUPING + COLLAPSE
 *
 * Alerts group by category rather than listing flat, and each group
 * collapses. Five grounded aircraft as five near-identical red rows is a
 * wall — the eye cannot tell "five aircraft with one problem each" from
 * "one aircraft with five", and a genuinely urgent single alert lower
 * down disappears into the texture.
 *
 * Collapsed is the default, but the summary is written so that collapsing
 * hides no information anyone needs to triage: the count, the category,
 * and the affected tails right there on the closed row. Opening a group
 * gets you the per-item detail and the links, not the news that a problem
 * exists. Hiding "which aircraft" behind a click would just move the wall
 * rather than remove it.
 *
 * Built on <details>/<summary> rather than useState so this stays a
 * server component — no hydration, keyboard and screen-reader behaviour
 * for free, and it still works if JS never arrives.
 */

const CATEGORY_LABEL: Record<OperationalAlert["category"], string> = {
  aircraft_grounded: "Aircraft grounded",
  flight_overdue: "Flights overdue",
  mel_expiring: "MELs expiring within 48 hours",
};

// Order the groups by what stops an aeroplane leaving, not alphabetically.
const CATEGORY_ORDER: OperationalAlert["category"][] = [
  "aircraft_grounded",
  "flight_overdue",
  "mel_expiring",
];

export function AlertsList({ alerts }: { alerts: OperationalAlert[] }) {
  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    items: alerts.filter((a) => a.category === category),
  })).filter((g) => g.items.length > 0);

  return (
    <section className="rounded-xl border border-black/10 bg-white">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-black/10 px-5 py-4">
        <h2 className="text-lg font-bold tracking-tight text-neutral-900">
          Active alerts
        </h2>
        <span className="text-xs text-neutral-500">
          {alerts.length === 0
            ? "Nothing needs attention"
            : `${alerts.length} open · 7 more alert types land with their services`}
        </span>
      </header>

      {alerts.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-neutral-500">
          Nothing from the wired sources — the fleet is airworthy, no flights
          are overdue, and no MELs expire in the next 48 hours.
        </p>
      ) : (
        <div className="divide-y divide-black/[0.06]">
          {groups.map(({ category, items }) => (
            <AlertGroup key={category} category={category} items={items} />
          ))}
        </div>
      )}
    </section>
  );
}

function AlertGroup({
  category,
  items,
}: {
  category: OperationalAlert["category"];
  items: OperationalAlert[];
}) {
  // A group is as severe as its worst member.
  const red = items.some((a) => a.severity === "red");

  return (
    <details className="group/disc px-5 py-3.5">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg py-0.5 outline-none [&::-webkit-details-marker]:hidden focus-visible:ring-2 focus-visible:ring-neutral-400">
        <span
          className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[0.7rem] font-bold tabular-nums ${
            red ? "bg-red-600 text-white" : "bg-amber-500 text-white"
          }`}
        >
          {items.length}
        </span>
        <h3 className="text-sm font-semibold text-neutral-900">
          {CATEGORY_LABEL[category]}
        </h3>
        {/* The affected tails, on the closed row. Collapsing should hide
            the detail, not the answer to "which ones?". */}
        <span className="min-w-0 flex-1 truncate text-xs text-neutral-500">
          {summarise(items)}
        </span>
        <span
          aria-hidden
          className="shrink-0 text-neutral-400 transition-transform duration-150 group-open/disc:rotate-90"
        >
          ›
        </span>
      </summary>

      <ul className="mt-2.5 space-y-1">
        {items.map((a) => (
          <li key={a.id}>
            <Link
              href={a.href}
              className="group flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-neutral-50"
            >
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="truncate font-medium text-neutral-900">
                  {/* The category is already the group heading — repeating
                      it on every row is what made this read as a wall. */}
                  {stripCategoryPrefix(a.title)}
                </span>
                <span className="truncate text-xs text-neutral-500">
                  {a.detail}
                </span>
              </span>
              <span
                aria-hidden
                className="shrink-0 text-neutral-300 transition-colors group-hover:text-neutral-500"
              >
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** "N200PA, N301PA, N402PA +2 more" — the identifiers, capped so a long
 *  group still fits on one line. Three is what fits at the narrowest
 *  width the Home panel renders at without the row wrapping. */
const SUMMARY_CAP = 3;

function summarise(items: OperationalAlert[]): string {
  const names = items.map((a) => stripCategoryPrefix(a.title));
  const shown = names.slice(0, SUMMARY_CAP).join(", ");
  const rest = names.length - SUMMARY_CAP;
  return rest > 0 ? `${shown} +${rest} more` : shown;
}

/** "Aircraft grounded — N200PA" → "N200PA". The group heading already
 *  says what kind of alert this is. Falls back to the whole title if the
 *  separator is not there, so an unexpected shape still renders. */
function stripCategoryPrefix(title: string): string {
  const [, rest] = title.split(" — ");
  return rest?.trim() || title;
}
