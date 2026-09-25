/**
 * Document-library filter row — matches legacy peregrineflight.com's
 * /documents/ filter bar: SEARCH text input + CATEGORY dropdown +
 * "Compliance sources only" checkbox + Filter button.
 *
 * The Clear link matches legacy, which renders one only while a
 * filter is active. It matters most for the compliance checkbox: that
 * filter can empty the list, and without a way out an operator is
 * left unticking a box and pressing Filter to get their library back.
 *
 * Plain HTML `<form method="get">` so submitting writes to the URL
 * query — Next.js re-renders the server component with the new
 * `searchParams` and the list re-filters. No client-side state, no
 * hydration required.
 */

import Link from "next/link";

export const DOCUMENT_CATEGORIES = [
  { value: "", label: "All Categories" },
  { value: "manuals", label: "Company Manuals (GOM, OPM)" },
  { value: "regulations", label: "Regulations (FAR/AIM)" },
  { value: "safety-bulletins", label: "Safety Bulletins" },
  { value: "compliance", label: "Compliance References" },
  { value: "training", label: "Training Materials" },
  { value: "company-policies", label: "Company Policies" },
] as const;

export function DocumentsFilterBar({
  initialSearch = "",
  initialCategory = "",
  initialComplianceOnly = false,
}: {
  initialSearch?: string;
  initialCategory?: string;
  initialComplianceOnly?: boolean;
} = {}) {
  // Shown only when something is actually filtered, as legacy does —
  // a permanent Clear next to Filter reads as a second action rather
  // than a way back.
  const filtersActive = Boolean(
    initialSearch || initialCategory || initialComplianceOnly,
  );

  return (
    <form
      role="search"
      method="get"
      className="rounded-lg border border-border bg-card px-4 py-3"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_minmax(220px,280px)_auto] md:items-end">
        <label className="block min-w-0">
          <span className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Search
          </span>
          <input
            name="q"
            type="search"
            defaultValue={initialSearch}
            placeholder="Title, tags, filename…"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </label>

        <label className="block min-w-0">
          <span className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Category
          </span>
          <select
            name="category"
            defaultValue={initialCategory}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          >
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.label === "All Categories" ? "" : c.label}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              name="compliance"
              type="checkbox"
              value="true"
              defaultChecked={initialComplianceOnly}
              className="h-3.5 w-3.5 rounded border-border"
            />
            Compliance sources only
          </label>
          <button
            type="submit"
            className="rounded-md border border-border bg-muted/60 px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent"
          >
            Filter
          </button>
          {filtersActive && (
            <Link
              href="/documents"
              className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-status-red hover:bg-status-red/10"
            >
              Clear
            </Link>
          )}
        </div>
      </div>
    </form>
  );
}
