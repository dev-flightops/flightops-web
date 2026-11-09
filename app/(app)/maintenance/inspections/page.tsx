import Link from "next/link";

import { auth } from "@/auth";
import { buttonSolid, linkCaps } from "@/components/ff/controls";
import { EmptyState } from "@/components/ff/empty-state";
import { Notice } from "@/components/ff/notice";
import { PageHeader } from "@/components/ff/page-header";
import { SegmentLinks } from "@/components/ff/segment-links";
import { StatusMark } from "@/components/ff/status-mark";
import { ApiError } from "@/lib/api/client";
import { listInspections, type InspectionList, type InspectionSummary, type InspectionView } from "@/lib/api/inspections";
import { formatIsoDay } from "@/lib/iso-day";
import { MX_SHOP_STAFF, hasAnyRole } from "@/lib/roles";

import { ProgressBar } from "./progress-bar";

/**
 * /maintenance/inspections (#178), legacy's templates/maintenance/inspections.html:
 * live completion tracking for each inspection.
 *
 * Legacy's tabs were Active, Completed and Signed Off, and it marked an
 * inspection completed by itself when its last item passed; nothing ever
 * signed one off. Here "Ready to sign off" is every item passed or corrected,
 * and Signed Off is a signature with a certificate.
 */

export const dynamic = "force-dynamic";

const VIEWS: { view: InspectionView; label: string }[] = [
  { view: "active", label: "Active" },
  { view: "ready", label: "Ready to sign off" },
  { view: "signed_off", label: "Signed off" },
  { view: "cancelled", label: "Cancelled" },
];

const EMPTY: Record<InspectionView, string> = {
  active: "No inspections in progress.",
  ready: "Nothing waiting for a sign-off.",
  signed_off: "No inspections signed off yet.",
  cancelled: "No cancelled inspections.",
};

function isView(value: string | undefined): value is InspectionView {
  return VIEWS.some((v) => v.view === value);
}

function Row({ insp, view }: { insp: InspectionSummary; view: InspectionView }) {
  const p = insp.progress;
  return (
    <tr>
      <td className="font-mono text-xs font-semibold">{insp.tail_number}</td>
      <td>
        <Link href={`/maintenance/inspections/${insp.id}`} className="font-semibold hover:underline">
          {insp.title}
        </Link>
        <span className="block text-xs text-muted-foreground">{insp.type_label}</span>
      </td>
      <td className="min-w-[160px]">
        <ProgressBar pct={p.pct} />
        <span className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          <span>
            {p.passed + p.corrected}/{p.total} items
          </span>
          {p.open_discrepancies > 0 ? (
            <span className="font-semibold text-status-red">
              {p.open_discrepancies} discrepanc{p.open_discrepancies === 1 ? "y" : "ies"} open
            </span>
          ) : null}
        </span>
      </td>
      {view === "signed_off" ? (
        <>
          <td className="whitespace-nowrap text-xs">{insp.signed_off_on ? formatIsoDay(insp.signed_off_on) : "—"}</td>
          <td className="text-xs">
            {insp.signer_name}
            {insp.cert_number ? <span className="block font-mono text-muted-foreground">{insp.cert_number}</span> : null}
          </td>
        </>
      ) : (
        <>
          <td className="whitespace-nowrap text-xs">{formatIsoDay(insp.started_on)}</td>
          <td className="whitespace-nowrap text-xs">{insp.target_on ? formatIsoDay(insp.target_on) : "—"}</td>
          <td className="text-xs">{insp.assigned_to_name ?? insp.vendor_name ?? "—"}</td>
        </>
      )}
      <td className="text-right">
        {view === "active" && insp.status === "open" ? <StatusMark label="Open" tone="gray" className="mr-3" /> : null}
        <Link href={`/maintenance/inspections/${insp.id}`} className={linkCaps}>
          Open<span className="sr-only"> {insp.title}</span> <span aria-hidden>›</span>
        </Link>
      </td>
    </tr>
  );
}

export default async function InspectionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await searchParams).view;
  const requested = Array.isArray(raw) ? raw[0] : raw;
  const view: InspectionView = isView(requested) ? requested : "active";
  const canEdit = hasAnyRole((await auth())?.roles ?? [], MX_SHOP_STAFF);

  let list: InspectionList | null = null;
  let loadError: string | null = null;
  try {
    list = await listInspections(view);
  } catch (err) {
    loadError =
      err instanceof ApiError && err.status === 401
        ? "Your session expired — please sign in again."
        : "The inspections are unavailable. Try refreshing in a moment.";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Inspection Tracker"
        back={{ href: "/maintenance", label: "Fleet" }}
        description="Live completion tracking for each inspection, through to its sign-off"
        actions={
          canEdit ? (
            <Link href="/maintenance/inspections/new" className={buttonSolid}>
              + New Inspection
            </Link>
          ) : null
        }
      />
      <SegmentLinks
        label="Inspections"
        className="mb-5"
        items={VIEWS.map((v) => ({
          href: v.view === "active" ? "/maintenance/inspections" : `/maintenance/inspections?view=${v.view}`,
          label: list ? `${v.label} · ${list.counts[v.view]}` : v.label,
          active: v.view === view,
        }))}
      />
      {loadError ? (
        <Notice tone="yellow" role="alert">
          {loadError}
        </Notice>
      ) : list && list.items.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="ff-table w-full text-sm">
            <thead className="ff-thead">
              <tr>
                <th>Aircraft</th>
                <th>Inspection</th>
                <th>Progress</th>
                {view === "signed_off" ? (
                  <>
                    <th>Signed Off</th>
                    <th>By</th>
                  </>
                ) : (
                  <>
                    <th>Started</th>
                    <th>Target</th>
                    <th>Assigned</th>
                  </>
                )}
                <th>
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((insp) => (
                <Row key={insp.id} insp={insp} view={view} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          action={
            canEdit && view === "active" ? (
              <Link href="/maintenance/inspections/new" className={buttonSolid}>
                Start Inspection
              </Link>
            ) : undefined
          }
        >
          {EMPTY[view]}
        </EmptyState>
      )}
    </div>
  );
}
