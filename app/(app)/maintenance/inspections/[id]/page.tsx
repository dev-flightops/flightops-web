import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { buttonOutline, linkCaps } from "@/components/ff/controls";
import { Notice } from "@/components/ff/notice";
import { PageHeader } from "@/components/ff/page-header";
import { Stat, StatStrip } from "@/components/ff/stat-strip";
import { StatusMark } from "@/components/ff/status-mark";
import { loadZoneTable } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { getInspection, type InspectionDetail } from "@/lib/api/inspections";
import { listAircraftDueItems, type DueItem } from "@/lib/api/maintenance";
import { localDay } from "@/lib/format/local-time";
import { formatIsoDay } from "@/lib/iso-day";
import { certLabel } from "@/lib/maintenance/parts";
import { AIRWORTHINESS_WRITERS, MX_SHOP_STAFF, hasAnyRole } from "@/lib/roles";

import { ProgressBar } from "../progress-bar";
import { Checklist } from "./checklist";
import { CancelInspection, SignOffForm } from "./sign-off-form";

/**
 * /maintenance/inspections/[id] (#178), legacy's inspection_detail.html: the
 * inspection's progress and its checklist by section, then the sign-off.
 */

export const dynamic = "force-dynamic";

const STATUS = {
  open: { label: "Open", tone: "gray" },
  in_progress: { label: "In progress", tone: "blue" },
  signed_off: { label: "Signed off", tone: "green" },
  cancelled: { label: "Cancelled", tone: "muted" },
} as const;

/** The due-list item an inspection most likely satisfies: the aircraft's one
 *  active inspection item whose title names the type. */
function suggestDueItem(insp: InspectionDetail, items: DueItem[]): string | null {
  const word = insp.inspection_type === "100hr" ? "100" : insp.type_label.toLowerCase();
  const matches = items.filter((i) => i.kind === "inspection" && i.title.toLowerCase().includes(word));
  return matches.length === 1 ? matches[0].id : null;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

export default async function InspectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const roles = session?.roles ?? [];
  let insp: InspectionDetail;
  try {
    insp = await getInspection(id);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 422)) notFound();
    throw err;
  }
  const live = insp.status === "open" || insp.status === "in_progress";
  const canEdit = live && hasAnyRole(roles, MX_SHOP_STAFF);
  const canSign = live && insp.progress.ready && hasAnyRole(roles, AIRWORTHINESS_WRITERS);

  let dueItems: DueItem[] = [];
  let today = "";
  if (canSign) {
    const [due, zones] = await Promise.allSettled([listAircraftDueItems(insp.aircraft_id), loadZoneTable()]);
    dueItems = due.status === "fulfilled" ? due.value.items.filter((i) => i.is_active) : [];
    today = localDay(zones.status === "fulfilled" ? zones.value.fallback : "America/Anchorage");
  }
  const p = insp.progress;
  const status = STATUS[insp.status];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <PageHeader
        title={insp.title}
        back={{ href: "/maintenance/inspections", label: "Inspections" }}
        description={
          <>
            <Link href={`/maintenance/aircraft/${insp.aircraft_id}`} className="font-mono font-semibold hover:underline">
              {insp.tail_number}
            </Link>
            {insp.aircraft_model ? ` · ${insp.aircraft_model}` : ""} · {insp.type_label}
          </>
        }
        actions={
          <>
            <StatusMark label={status.label} tone={status.tone} />
            {canEdit ? (
              <Link href={`/maintenance/inspections/${insp.id}/edit`} className={buttonOutline}>
                Edit
              </Link>
            ) : null}
          </>
        }
      />

      {insp.status === "signed_off" ? (
        <Notice tone="green" label="Signed off" className="mb-6">
          {`${insp.signed_off_on ? formatIsoDay(insp.signed_off_on) : ""} by ${insp.signer_name ?? "—"}, ${certLabel(insp.cert_type ?? "")} ${insp.cert_number ?? ""}, at ${insp.total_time_hours ?? "—"} hours total time.`}
          {insp.due_item_title ? ` Recorded on the due list as ${insp.due_item_title}.` : ""}
          {insp.sign_off_notes ? ` ${insp.sign_off_notes}` : ""}
        </Notice>
      ) : insp.status === "cancelled" ? (
        <Notice tone="gray" label="Cancelled" className="mb-6">
          This inspection was called off. Squawks its items opened stay on the aircraft.
        </Notice>
      ) : null}

      <dl className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Fact label="Started">{formatIsoDay(insp.started_on)}</Fact>
        <Fact label="Target">{insp.target_on ? formatIsoDay(insp.target_on) : "—"}</Fact>
        <Fact label="Hours at Start">
          <span className="font-mono">{insp.aircraft_hours_at_start ?? "—"}</span>
        </Fact>
        <Fact label="Assigned To">{insp.assigned_to_name ?? "—"}</Fact>
        {insp.vendor_name ? <Fact label="Done By">{insp.vendor_name}</Fact> : null}
        {insp.wo_number ? (
          <Fact label="Work Order">
            <Link href={`/maintenance/work-orders/${insp.work_order_id}`} className={linkCaps}>
              {insp.wo_number} <span aria-hidden>›</span>
            </Link>
          </Fact>
        ) : null}
      </dl>
      {insp.notes ? <p className="mb-6 whitespace-pre-line text-sm text-muted-foreground">{insp.notes}</p> : null}

      <div className="mb-2 flex items-baseline justify-between">
        <span className="eyebrow">Progress</span>
        <span className="font-display text-2xl font-extrabold tabular-nums">{p.pct}%</span>
      </div>
      <ProgressBar pct={p.pct} className="mb-4" />
      <StatStrip label="Checklist">
        <Stat value={p.total} label="Total" />
        <Stat value={p.passed + p.corrected} label="Done" tone="green" />
        <Stat value={p.pending} label="Pending" tone="gray" />
        <Stat value={p.open_discrepancies} label="Discrepancies" tone={p.open_discrepancies ? "red" : "neutral"} />
      </StatStrip>

      <Checklist inspectionId={insp.id} aircraftId={insp.aircraft_id} items={insp.items} canEdit={canEdit} />

      {live ? (
        <div className="mt-6 space-y-4">
          {canSign ? (
            <SignOffForm
              inspectionId={insp.id}
              today={today}
              signer={session?.user?.name?.trim() ?? ""}
              totalHours={insp.aircraft_total_hours}
              annual={insp.inspection_type === "annual"}
              dueItems={dueItems.map((d) => ({ id: d.id, label: d.summary }))}
              suggestedDueItemId={suggestDueItem(insp, dueItems)}
            />
          ) : p.total > 0 ? (
            <Notice tone="blue" label="Sign-off">
              {p.ready
                ? "Every item has passed or been corrected: maintenance, the Director of Maintenance or an Exec Admin signs it off."
                : `${p.pending ? `${p.pending} item${p.pending === 1 ? "" : "s"} to check` : ""}${p.pending && p.open_discrepancies ? " and " : ""}${p.open_discrepancies ? `${p.open_discrepancies} discrepanc${p.open_discrepancies === 1 ? "y" : "ies"} to resolve` : ""} before it can be signed off.`}
            </Notice>
          ) : null}
          {canEdit ? (
            <div className="flex justify-end">
              <CancelInspection inspectionId={insp.id} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
