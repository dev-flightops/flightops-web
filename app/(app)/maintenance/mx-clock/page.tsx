import Link from "next/link";

import { auth } from "@/auth";
import { buttonOutline } from "@/components/ff/controls";
import { Notice } from "@/components/ff/notice";
import { PageHeader } from "@/components/ff/page-header";
import { loadZoneTable } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { listMxClocks, listWorkOrders, type MxClockList } from "@/lib/api/maintenance";
import { listAircraft } from "@/lib/api/ops";
import { localDateTime } from "@/lib/format/local-time";
import { MX_SHOP_STAFF, hasAnyRole } from "@/lib/roles";

import { BeginWorkForm } from "./begin-work-form";
import { ClockCard } from "./clock-card";

/**
 * /maintenance/mx-clock (#172), legacy's mx_clock.html: the time an aircraft spends
 * in maintenance, with milestones and the mechanics on it. Availability reads these.
 */

export const dynamic = "force-dynamic";

const OPEN_ORDERS = ["open", "in_progress", "awaiting_parts"] as const;

export default async function MxClockPage() {
  const canRun = hasAnyRole((await auth())?.roles ?? [], MX_SHOP_STAFF);
  let clocks: MxClockList | null = null;
  let loadError: string | null = null;
  try {
    clocks = await listMxClocks();
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "The maintenance clock is unavailable. Try refreshing in a moment.";
  }
  const [zones, fleet, orders] = await Promise.all([
    loadZoneTable().catch(() => null),
    canRun ? listAircraft().catch(() => null) : Promise.resolve(null),
    canRun
      ? Promise.all(OPEN_ORDERS.map((status) => listWorkOrders({ status }).catch(() => null)))
      : Promise.resolve([]),
  ]);
  const zone = zones?.fallback ?? "America/Anchorage";
  const when = (at: string) => localDateTime(at, zone);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Maintenance Clock"
        back={{ href: "/maintenance", label: "Fleet" }}
        description="Track aircraft maintenance time with milestones."
        actions={
          <Link href="/maintenance/availability" className={buttonOutline}>
            Availability Report
          </Link>
        }
      />

      {loadError ? (
        <Notice tone="yellow" role="alert" className="mb-4">
          {loadError}
        </Notice>
      ) : null}

      {canRun ? (
        <section aria-label="Begin maintenance" className="mb-6 rounded-lg border border-border bg-card p-4">
          <h2 className="section-title mb-3">Begin Maintenance</h2>
          <BeginWorkForm
            aircraft={(fleet?.items ?? []).filter((a) => a.is_active)}
            workOrders={orders.flatMap((list) =>
              (list?.items ?? []).map((o) => ({
                id: o.id,
                wo_number: o.wo_number,
                aircraft_id: o.aircraft_id,
                title: o.title,
              })),
            )}
          />
        </section>
      ) : null}

      {clocks && clocks.active.length > 0 ? (
        <section aria-label="Active clocks" className="mb-6">
          <h2 className="section-title mb-3 text-status-green">Active ({clocks.active.length})</h2>
          <div className="space-y-4">
            {clocks.active.map((clock) => (
              <ClockCard
                key={clock.id}
                clock={clock}
                canRun={canRun}
                started={when(clock.started_at)}
                stamps={Object.fromEntries(clock.milestones.filter((m) => m.at).map((m) => [m.key, when(m.at as string)]))}
              />
            ))}
          </div>
        </section>
      ) : null}

      {clocks && clocks.recent.length > 0 ? (
        <section aria-label="Recently completed">
          <h2 className="section-title mb-2">Recently Completed</h2>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="ff-table w-full text-sm">
              <thead className="ff-thead">
                <tr>
                  <th>Aircraft</th>
                  <th>Started</th>
                  <th>Completed</th>
                  <th className="text-right">Total Hours</th>
                  <th>Started By</th>
                </tr>
              </thead>
              <tbody>
                {clocks.recent.map((clock) => (
                  <tr key={clock.id}>
                    <td className="font-mono font-bold">{clock.aircraft.tail_number}</td>
                    <td className="whitespace-nowrap font-mono text-xs">{when(clock.started_at)}</td>
                    <td className="whitespace-nowrap font-mono text-xs">{clock.completed_at ? when(clock.completed_at) : "—"}</td>
                    <td className="text-right font-mono font-semibold">{clock.total_hours != null ? clock.total_hours.toFixed(1) : "—"}</td>
                    <td className="text-xs text-muted-foreground">{clock.started_by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {clocks && clocks.active.length === 0 && clocks.recent.length === 0 ? (
        <p className="rounded-lg border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
          {canRun ? "No maintenance clocks. Select an aircraft above and press Begin Work." : "No maintenance clocks."}
        </p>
      ) : null}
    </div>
  );
}
