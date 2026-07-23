"use client";

import { useState } from "react";

/** Inventory filter — matches legacy `inventory.html` filter panel:
 * Search text input + Category dropdown + low-stock-only checkbox +
 * Filter button. State is client-local until the parts endpoint
 * lands (Marc's M2 maintenance-service). */
export function InventoryFilterBar({
  categories,
}: {
  categories: Array<{ value: string; label: string }>;
}) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [lowStock, setLowStock] = useState(false);

  return (
    <form
      role="search"
      className="mb-5 rounded-lg border border-border bg-card px-4 py-3"
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[180px] flex-1">
          <span className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Search
          </span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Part number or description"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-status-blue focus:ring-2 focus:ring-status-blue/30"
          />
        </label>
        <label className="min-w-[140px]">
          <span className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Category
          </span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-status-blue focus:ring-2 focus:ring-status-blue/30"
          >
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 pb-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={lowStock}
            onChange={(e) => setLowStock(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-border"
          />
          Low stock only
        </label>
        <button
          type="submit"
          className="rounded-md border border-border bg-muted/30 px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/50"
        >
          Filter
        </button>
      </div>
    </form>
  );
}
