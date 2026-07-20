"use client";

import { useState } from "react";

/**
 * Document-library filter row — matches legacy peregrineflight.com's
 * /documents/ filter bar: SEARCH text input + CATEGORY dropdown +
 * "Compliance sources only" checkbox + Filter button.
 *
 * State is local until the documents-service ships (Marc's M3 backend);
 * pressing Filter then updates the URL query and the parent will
 * re-fetch. Today it just captures the intent so the layout is
 * indistinguishable from the wired-up version.
 */

export const DOCUMENT_CATEGORIES = [
  { value: "", label: "All Categories" },
  { value: "manuals", label: "Company Manuals (GOM, OPM)" },
  { value: "regulations", label: "Regulations (FAR/AIM)" },
  { value: "safety-bulletins", label: "Safety Bulletins" },
  { value: "compliance", label: "Compliance References" },
  { value: "training", label: "Training Materials" },
  { value: "company-policies", label: "Company Policies" },
] as const;

export function DocumentsFilterBar() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("");
  const [complianceOnly, setComplianceOnly] = useState(false);

  return (
    <form
      role="search"
      className="rounded-lg border border-border bg-card px-4 py-3"
      onSubmit={(e) => {
        e.preventDefault();
        // No-op until the backend lands; UI captures the intent so the
        // form still feels responsive.
      }}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_minmax(220px,280px)_auto] md:items-end">
        <label className="block min-w-0">
          <span className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Search
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Title, tags, filename…"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-status-blue focus:ring-2 focus:ring-status-blue/30"
          />
        </label>

        <label className="block min-w-0">
          <span className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Category
          </span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-status-blue focus:ring-2 focus:ring-status-blue/30"
          >
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={complianceOnly}
              onChange={(e) => setComplianceOnly(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border"
            />
            Compliance sources only
          </label>
          <button
            type="submit"
            className="rounded-md border border-border bg-muted/30 px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/50"
          >
            Filter
          </button>
        </div>
      </div>
    </form>
  );
}
