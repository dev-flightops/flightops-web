import { NotBuiltPage } from "@/components/not-built-page";

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
 *
 * NOT BUILT. This page used to render that layout with every control
 * disabled or empty, and the nav called it live because the file
 * existed. There is no maintenance-service endpoint behind it, so it
 * says so instead (components/not-built-page.tsx); the nav marks it
 * `planned`. The layout above is the brief for building it.
 */
export default function BatchTracePage() {
  return (
    <NotBuiltPage
      title="Batch & Lot Traceability"
      summary="Every aircraft that received a part from a given batch or lot — for AD compliance and recalls."
    />
  );
}
