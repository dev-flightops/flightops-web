"use client";

import { useState } from "react";

/** Batch/Lot search form — matches legacy `batch_trace.html`. State
 * is client-local until Marc's M2 maintenance-service batch registry
 * ships. */
export function BatchTraceSearch() {
  const [batch, setBatch] = useState("");
  const [lot, setLot] = useState("");
  const canClear = batch !== "" || lot !== "";

  return (
    <form
      role="search"
      className="mb-5 rounded-lg border border-border bg-card px-4 py-3"
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[200px]">
          <span className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Batch Number
          </span>
          <input
            type="text"
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            placeholder="Enter batch #"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-status-blue focus:ring-2 focus:ring-status-blue/30"
          />
        </label>
        <label className="min-w-[200px]">
          <span className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Lot Number
          </span>
          <input
            type="text"
            value={lot}
            onChange={(e) => setLot(e.target.value)}
            placeholder="Enter lot #"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-status-blue focus:ring-2 focus:ring-status-blue/30"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-status-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
        >
          Trace
        </button>
        {canClear && (
          <button
            type="button"
            onClick={() => {
              setBatch("");
              setLot("");
            }}
            className="rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/30"
          >
            Clear
          </button>
        )}
      </div>
    </form>
  );
}
