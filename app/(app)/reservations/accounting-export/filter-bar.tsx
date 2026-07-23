"use client";

import { useState } from "react";

/** Accounting Export filter — matches legacy `acct_export/review.html`.
 * State is client-local until the ops-service completed-flights
 * aggregate endpoint lands. */
export function AcctExportFilterBar() {
  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);
  const isoDate = (d: Date) => d.toISOString().slice(0, 10);

  const [start, setStart] = useState(isoDate(monthAgo));
  const [end, setEnd] = useState(isoDate(today));
  const [customer, setCustomer] = useState("");
  const reset = () => {
    setStart(isoDate(monthAgo));
    setEnd(isoDate(today));
    setCustomer("");
  };

  return (
    <form
      role="search"
      className="mb-5 flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card px-4 py-3"
      onSubmit={(e) => e.preventDefault()}
    >
      <label>
        <span className="mb-1 block text-xs text-muted-foreground">From</span>
        <input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="w-40 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-status-blue focus:ring-2 focus:ring-status-blue/30"
        />
      </label>
      <label>
        <span className="mb-1 block text-xs text-muted-foreground">To</span>
        <input
          type="date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="w-40 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-status-blue focus:ring-2 focus:ring-status-blue/30"
        />
      </label>
      <label>
        <span className="mb-1 block text-xs text-muted-foreground">Customer</span>
        <select
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
          className="w-56 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-status-blue focus:ring-2 focus:ring-status-blue/30"
        >
          <option value="">All Customers</option>
        </select>
      </label>
      <button
        type="submit"
        className="rounded-md border border-border bg-muted/30 px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/50"
      >
        Filter
      </button>
      <button
        type="button"
        onClick={reset}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        Reset
      </button>
    </form>
  );
}
