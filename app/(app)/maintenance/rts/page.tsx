import Link from "next/link";

import { auth } from "@/auth";
import { linkCaps } from "@/components/ff/controls";
import { Notice } from "@/components/ff/notice";
import { PageHeader } from "@/components/ff/page-header";
import { StatusMark } from "@/components/ff/status-mark";
import { loadZoneTable } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { getRtsQueue, type RtsAircraft, type RtsQueue, type RtsSquawk } from "@/lib/api/maintenance";
import { localDateTime } from "@/lib/format/local-time";
import { certLabel } from "@/lib/maintenance/parts";
import { AIRWORTHINESS_WRITERS, WORK_ORDER_WRITERS, hasAnyRole } from "@/lib/roles";

import { DeferForm, InspectForm, RejectForm, SignOffForm } from "./rts-forms";

/**
 * /maintenance/rts (#172), legacy's rts_queue.html.
 *
 *   1. RII: an AMT has signed, and an inspector has to.
 *   2. Pending RTS: its work order is finished, and the squawk is still open.
 *   3. Open squawks holding an aircraft: grounding, with the work still to do.
 *   4. The aircraft held, by whatever the release reads.
 *
 * Where this departs from legacy is at the top of
 * services/maintenance/app/routes/rts.py.
 */

export const dynamic = "force-dynamic";

function AircraftLine({ aircraft }: { aircraft: RtsAircraft }) {
  return (
    <>
      <Link href={`/maintenance/aircraft/${aircraft.id}`} className="font-mono font-bold text-foreground hover:underline">
        {aircraft.tail_number}
      </Link>
      {aircraft.model ? <span className="text-xs text-muted-foreground">{aircraft.model}</span> : null}
      {aircraft.base ? <span className="font-mono text-xs text-muted-foreground">{aircraft.base}</span> : null}
    </>
  );
}

function CardTop({ squawk, zone, mark }: { squawk: RtsSquawk; zone: string; mark: React.ReactNode }) {
  return (
    <>
      <div className="flex flex-wrap items-baseline gap-3">
        <AircraftLine aircraft={squawk.aircraft} />
        {mark}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Reported {localDateTime(squawk.reported_at, zone)} by {squawk.reported_by}
        {squawk.work_order ? (
          <>
            {" · "}
            <Link href={`/maintenance/work-orders/${squawk.work_order.id}`} className="font-mono text-primary hover:underline">
              {squawk.work_order.wo_number}
            </Link>
          </>
        ) : null}
      </p>
      <div className="mt-3 rounded-md border border-border p-3 text-sm">
        <p className="font-semibold">{squawk.title}</p>
        {squawk.description !== squawk.title ? <p className="mt-1 text-muted-foreground">{squawk.description}</p> : null}
      </div>
      {squawk.rts_rejection_notes ? (
        <Notice tone="red" label="Previous rejection" className="mt-3">
          {squawk.rts_rejection_notes}
        </Notice>
      ) : null}
    </>
  );
}

function More({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="text-sm">
      <summary className={`${linkCaps} cursor-pointer`}>{label}</summary>
      {children}
    </details>
  );
}

function Empty({ canSign }: { canSign: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card px-5 py-12 text-center">
      <p className="font-semibold text-status-green">No pending RTS items</p>
      <p className="mt-1 text-sm text-muted-foreground">
        All aircraft are cleared. No squawks awaiting signoff.
        {canSign ? null : " Sign-offs are maintenance's."}
      </p>
    </div>
  );
}

export default async function RtsQueuePage() {
  const session = await auth();
  const roles = session?.roles ?? [];
  const canSign = hasAnyRole(roles, AIRWORTHINESS_WRITERS);
  const canOpenWorkOrder = hasAnyRole(roles, WORK_ORDER_WRITERS);
  const name = session?.user?.name?.trim() ?? "";
  let queue: RtsQueue | null = null;
  let loadError: string | null = null;
  try {
    queue = await getRtsQueue();
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "The RTS queue is unavailable. Try refreshing in a moment.";
  }
  const zones = await loadZoneTable().catch(() => null);
  const zone = zones?.fallback ?? "America/Anchorage";
  const nothing =
    queue &&
    queue.pending_rii.length + queue.pending_rts.length + queue.open_on_hold.length + queue.held_aircraft.length === 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Return to Service Queue"
        back={{ href: "/maintenance", label: "Fleet" }}
        description="Aircraft pending AMT signoff or RII inspector review."
      />

      {!canSign ? (
        <Notice tone="blue" className="mb-5">
          View only: maintenance, the Director of Maintenance or an Exec Admin can sign.
        </Notice>
      ) : null}

      {loadError ? (
        <Notice tone="yellow" role="alert">
          {loadError}
        </Notice>
      ) : null}

      {nothing ? <Empty canSign={canSign} /> : null}

      {queue && queue.pending_rii.length > 0 ? (
        <section aria-label="RII awaiting inspector" className="mb-8">
          <h2 className="section-title mb-3 text-status-yellow">RII: Awaiting Inspector Signoff ({queue.pending_rii.length})</h2>
          <div className="space-y-4">
            {queue.pending_rii.map((squawk) => (
              <article key={squawk.id} aria-label={`${squawk.aircraft.tail_number}: ${squawk.title}`} className="rounded-lg border border-border border-l-2 border-l-status-yellow bg-card p-4">
                <CardTop squawk={squawk} zone={zone} mark={<StatusMark label="RII: Dual Signoff" tone="yellow" />} />
                <div className="mt-3 rounded-md border border-border p-3 text-sm">
                  <p className="field-label">Primary AMT Signoff (Complete)</p>
                  <dl className="mt-1 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    <div>
                      <dt className="text-muted-foreground">AMT</dt>
                      <dd>{squawk.rts_amt_name ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Certificate</dt>
                      <dd className="font-mono">{squawk.rts_amt_cert_number ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Type</dt>
                      <dd>{certLabel(squawk.rts_amt_cert_type)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Signed</dt>
                      <dd className="font-mono">{squawk.rts_submitted_at ? localDateTime(squawk.rts_submitted_at, zone) : "—"}</dd>
                    </div>
                  </dl>
                  {squawk.rts_work_notes ? <p className="mt-2 whitespace-pre-wrap">{squawk.rts_work_notes}</p> : null}
                </div>
                {canSign ? (
                  <div className="mt-4 border-t border-border pt-4">
                    {squawk.signed_by_me ? (
                      <Notice tone="yellow" label="Someone else has to inspect this" className="mb-3">
                        You signed this work off. 14 CFR 135.429 doesn&apos;t let the person who did the work inspect it.
                      </Notice>
                    ) : (
                      <>
                        <h3 className="field-label mb-2 text-status-yellow">RII Inspector Signoff</h3>
                        <InspectForm squawkId={squawk.id} aircraftId={squawk.aircraft.id} name={name} />
                      </>
                    )}
                    <div className="mt-4 flex flex-wrap gap-6 border-t border-border pt-3">
                      <More label="Reject: return to open">
                        <RejectForm squawkId={squawk.id} aircraftId={squawk.aircraft.id} />
                      </More>
                      <More label="Defer">
                        <DeferForm squawkId={squawk.id} aircraftId={squawk.aircraft.id} />
                      </More>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 border-t border-border pt-3 text-xs text-status-yellow">RII inspection required before return to service.</p>
                )}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {queue && queue.pending_rts.length > 0 ? (
        <section aria-label="Pending return to service" className="mb-8">
          <h2 className="section-title mb-3 text-status-blue">Pending RTS: Awaiting Signoff ({queue.pending_rts.length})</h2>
          <div className="space-y-4">
            {queue.pending_rts.map((squawk) => (
              <article key={squawk.id} aria-label={`${squawk.aircraft.tail_number}: ${squawk.title}`} className="rounded-lg border border-border border-l-2 border-l-status-blue bg-card p-4">
                <CardTop
                  squawk={squawk}
                  zone={zone}
                  mark={
                    <>
                      <StatusMark label="Pending RTS" tone="blue" />
                      {squawk.is_rii ? <StatusMark label="RII Required" tone="yellow" /> : null}
                    </>
                  }
                />
                {canSign ? (
                  <div className="mt-4 border-t border-border pt-4">
                    <SignOffForm squawkId={squawk.id} aircraftId={squawk.aircraft.id} name={name} rii={squawk.is_rii} />
                    <div className="mt-4 border-t border-border pt-3">
                      <More label="Defer">
                        <DeferForm squawkId={squawk.id} aircraftId={squawk.aircraft.id} />
                      </More>
                    </div>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {queue && queue.open_on_hold.length > 0 ? (
        <section aria-label="Open squawks on held aircraft" className="mb-8">
          <h2 className="section-title mb-3 text-status-red">Open Squawks on Held Aircraft ({queue.open_on_hold.length})</h2>
          <div className="space-y-3">
            {queue.open_on_hold.map((squawk) => (
              <article key={squawk.id} aria-label={`${squawk.aircraft.tail_number}: ${squawk.title}`} className="rounded-lg border border-border border-l-2 border-l-status-red bg-card p-4">
                <CardTop
                  squawk={squawk}
                  zone={zone}
                  mark={
                    <>
                      <StatusMark label="Open: Work Required" tone="red" />
                      {squawk.is_rii ? <StatusMark label="RII Required" tone="yellow" /> : null}
                    </>
                  }
                />
                <div className="mt-3 flex flex-wrap gap-6">
                  {!squawk.work_order && canOpenWorkOrder ? (
                    <Link href={`/maintenance/work-orders/new?squawk=${squawk.id}`} className={linkCaps}>
                      Open work order <span aria-hidden>›</span>
                    </Link>
                  ) : null}
                  {canSign ? (
                    <>
                      <More label="Sign off airworthy">
                        <div className="mt-2">
                          <SignOffForm squawkId={squawk.id} aircraftId={squawk.aircraft.id} name={name} rii={squawk.is_rii} />
                        </div>
                      </More>
                      <More label="Defer">
                        <DeferForm squawkId={squawk.id} aircraftId={squawk.aircraft.id} />
                      </More>
                    </>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {queue && queue.held_aircraft.length > 0 ? (
        <section aria-label="Aircraft on hold">
          <h2 className="section-title mb-2">Aircraft Currently on RTS Hold ({queue.held_aircraft.length})</h2>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="ff-table w-full text-sm">
              <thead className="ff-thead">
                <tr>
                  <th>N-Number</th>
                  <th>Type</th>
                  <th>Base</th>
                  <th>Why</th>
                  <th>
                    <span className="sr-only">View</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {queue.held_aircraft.map(({ aircraft, reasons }) => (
                  <tr key={aircraft.id}>
                    <td className="font-mono font-bold">{aircraft.tail_number}</td>
                    <td className="text-xs text-muted-foreground">{aircraft.model ?? "—"}</td>
                    <td className="font-mono text-xs text-muted-foreground">{aircraft.base ?? "—"}</td>
                    <td className="text-xs">
                      <StatusMark label="RTS Hold" tone="red" />
                      <ul className="mt-1 text-muted-foreground">
                        {reasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    </td>
                    <td className="text-right">
                      <Link href={`/maintenance/aircraft/${aircraft.id}`} className={linkCaps}>
                        View<span className="sr-only"> {aircraft.tail_number}</span> <span aria-hidden>›</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
