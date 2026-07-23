import Link from "next/link";

import { BatchTraceSearch } from "./search";

/**
 * /maintenance/batch-trace — legacy
 * `templates/maintenance/batch_trace.html`.
 *
 * Trace every aircraft that received a part from a specific batch or
 * lot number — critical for AD compliance and recall situations.
 * Search: Batch # input + Lot # input + Trace/Clear buttons + results
 * table (Date · Part · Batch · Lot · Type · Qty · Aircraft · Work
 * Order · Recorded By) + Affected Aircraft Summary chips.
 *
 * Backend not shipped — Marc's maintenance-service batch registry
 * still to land. Search state is client-local; swap to
 * `traceBatch({ batch, lot })` once the endpoint exists.
 */
export default function BatchTracePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <Link
        href="/maintenance/inventory"
        className="mb-4 inline-block text-sm text-status-blue hover:underline"
      >
        ← Inventory
      </Link>
      <h1 className="mb-1 text-xl font-bold">Batch & Lot Traceability</h1>
      <p className="mb-5 text-xs text-muted-foreground">
        Trace every aircraft that received a part from a specific batch or lot
        number. Critical for AD compliance and recall situations.
      </p>

      <BatchTraceSearch />

      <div className="rounded-lg border border-border bg-card px-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          Enter a batch or lot number above to trace parts across the fleet.
        </p>
      </div>
    </div>
  );
}
