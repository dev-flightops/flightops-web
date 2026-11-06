import Link from "next/link";

import { buttonOutline, buttonSolid } from "@/components/ff/controls";
import { Notice } from "@/components/ff/notice";
import { PageHeader } from "@/components/ff/page-header";
import { loadZoneTable } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { tracePart, type PartTrace } from "@/lib/api/maintenance";
import { localDateTime } from "@/lib/format/local-time";
import { TXN_LABEL, formatQty } from "@/lib/maintenance/parts";

/**
 * /maintenance/batch-trace (#172), legacy's batch_trace.html: every movement of a
 * batch or lot, and the aircraft that received it, for an AD or a recall. Legacy's
 * Recorded By column printed the transaction's reference; here it's the person.
 */

export const dynamic = "force-dynamic";

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export default async function BatchTracePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const batch = one(params.batch);
  const lot = one(params.lot);
  let trace: PartTrace | null = null;
  let loadError: string | null = null;
  try {
    trace = await tracePart({ batch, lot });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Batch trace is unavailable. Try refreshing in a moment.";
  }
  const zones = await loadZoneTable().catch(() => null);
  const zone = zones?.fallback ?? "America/Anchorage";
  const searched = Boolean(batch || lot);
  const matching = [batch && `batch "${batch}"`, lot && `lot "${lot}"`].filter(Boolean).join(" and ");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Batch & Lot Traceability"
        back={{ href: "/maintenance/inventory", label: "Inventory" }}
        description="Trace every aircraft that received a part from a specific batch or lot number. Critical for AD compliance and recalls."
      />

      <form method="get" action="/maintenance/batch-trace" className="mb-5 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="trace-batch" className="field-label">
            Batch Number
          </label>
          <input
            id="trace-batch"
            name="batch"
            defaultValue={batch}
            list="trace-batches"
            placeholder="Enter batch #"
            className="ff-input w-52 px-3 py-2 text-sm"
          />
          <datalist id="trace-batches">
            {(trace?.batches ?? []).map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </div>
        <div>
          <label htmlFor="trace-lot" className="field-label">
            Lot Number
          </label>
          <input id="trace-lot" name="lot" defaultValue={lot} placeholder="Enter lot #" className="ff-input w-52 px-3 py-2 text-sm" />
        </div>
        <button type="submit" className={buttonSolid}>
          Trace
        </button>
        {searched ? (
          <Link href="/maintenance/batch-trace" className={buttonOutline}>
            Clear
          </Link>
        ) : null}
      </form>

      {loadError ? (
        <Notice tone="yellow" role="alert">
          {loadError}
        </Notice>
      ) : !searched ? (
        <p className="rounded-lg border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
          Enter a batch or lot number above to trace parts across the fleet.
        </p>
      ) : trace && trace.results.length === 0 ? (
        <p className="rounded-lg border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
          No transactions found for this batch or lot number.
        </p>
      ) : trace ? (
        <>
          <Notice tone="blue" className="mb-4" role="status">
            Found {trace.results.length} transaction{trace.results.length === 1 ? "" : "s"} matching {matching}.
          </Notice>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="ff-table w-full text-sm">
              <thead className="ff-thead">
                <tr>
                  <th>Date</th>
                  <th>Part</th>
                  <th>Batch</th>
                  <th>Lot</th>
                  <th>Type</th>
                  <th className="text-right">Qty</th>
                  <th>Aircraft</th>
                  <th>Work Order</th>
                  <th>Recorded By</th>
                </tr>
              </thead>
              <tbody>
                {trace.results.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap font-mono text-xs">{localDateTime(row.recorded_at, zone)}</td>
                    <td>
                      <Link href={`/maintenance/inventory/${row.part_id}`} className="font-mono text-xs font-semibold text-primary hover:underline">
                        {row.part_number}
                      </Link>
                      <span className="block text-xs text-muted-foreground">{row.part_description}</span>
                    </td>
                    <td className="font-mono text-xs">{row.batch_number ?? "—"}</td>
                    <td className="font-mono text-xs">{row.lot_number ?? "—"}</td>
                    <td className="text-xs">{TXN_LABEL[row.txn_type]}</td>
                    <td className="text-right font-mono">{formatQty(row.quantity)}</td>
                    <td className="font-mono text-xs">
                      {row.aircraft_id ? (
                        <Link href={`/maintenance/aircraft/${row.aircraft_id}`} className="text-primary hover:underline">
                          {row.aircraft_tail}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="font-mono text-xs">
                      {row.work_order_id ? (
                        <Link href={`/maintenance/work-orders/${row.work_order_id}`} className="text-primary hover:underline">
                          {row.wo_number}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="text-xs text-muted-foreground">{row.recorded_by ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {trace.affected_aircraft.length > 0 ? (
            <section aria-label="Affected aircraft" className="mt-5">
              <h2 className="section-title mb-2 text-status-red">Affected Aircraft Summary</h2>
              <ul className="flex flex-wrap gap-2">
                {trace.affected_aircraft.map((a) => (
                  <li key={a.id}>
                    <Link href={`/maintenance/aircraft/${a.id}`} className={buttonOutline}>
                      <span className="font-mono">{a.tail_number}</span>
                      {a.model ? <span className="text-xs font-normal normal-case text-muted-foreground">{a.model}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
