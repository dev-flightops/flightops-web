import Link from "next/link";
import { notFound } from "next/navigation";

import { ChangeStatusDialog } from "@/components/equipment/change-status-dialog";
import { CompleteMaintenanceButton } from "@/components/equipment/complete-maintenance-button";
import { ReportSquawkDialog } from "@/components/equipment/report-squawk-dialog";
import { ResolveSquawkButton } from "@/components/equipment/resolve-squawk-button";
import { ScheduleMaintenanceDialog } from "@/components/equipment/schedule-maintenance-dialog";
import { ApiError } from "@/lib/api/client";
import {
  getGseUnit,
  listGseMaintenance,
  listGseSquawks,
} from "@/lib/api/ground";
import type {
  GSEEquipmentType,
  GSEMaintenanceItemResponse,
  GSEMxStatus,
  GSESquawkResponse,
  GSEUnitListItem,
  GSEUnitStatus,
} from "@/lib/api/types";

/**
 * /equipment/{id} — GSE unit detail (M2-G-39).
 *
 * Mirrors legacy `templates/gse/detail.html`:
 *   - Header: name + type label + status pill, with "← Equipment" back link
 *   - Meta block: make/model, serial, year, station, hours, intervals
 *   - Scheduled maintenance items section (one row per recurring or
 *     one-off MX item, status pill, intervals + due_date)
 *   - Squawks section split into open + recently-resolved
 *   - Status change form, MX schedule form, squawk submit/resolve forms
 *     land in M2-G-39b
 */
export default async function EquipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let unit: GSEUnitListItem | null = null;
  let maintenance: GSEMaintenanceItemResponse[] = [];
  let squawks: GSESquawkResponse[] = [];
  let loadError: string | null = null;

  try {
    const [u, mx, sq] = await Promise.all([
      getGseUnit(id),
      listGseMaintenance(id, { limit: 50 }),
      listGseSquawks(id, { limit: 50 }),
    ]);
    unit = u;
    maintenance = mx.items;
    squawks = sq.items;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Equipment unavailable. Try refreshing in a moment.";
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <BackLink />
        <div
          role="alert"
          className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      </div>
    );
  }
  if (unit === null) notFound();

  const openSquawks = squawks.filter(
    (s) => s.status === "open" || s.status === "in_progress",
  );
  const resolvedSquawks = squawks.filter((s) => s.status === "resolved");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <BackLink />
      <Header unit={unit} />
      <Meta unit={unit} />
      <MaintenanceSection
        unitId={unit.id}
        unitHours={unit.hours_total}
        items={maintenance}
      />
      <SquawksSection
        unitId={unit.id}
        title={`Open squawks (${openSquawks.length})`}
        squawks={openSquawks}
        emptyHint="No open squawks on this unit."
        showReportButton
        showResolve
      />
      {resolvedSquawks.length > 0 && (
        <SquawksSection
          unitId={unit.id}
          title={`Recently resolved (${resolvedSquawks.length})`}
          squawks={resolvedSquawks}
          emptyHint=""
        />
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/equipment"
      className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground hover:underline"
    >
      ← Equipment
    </Link>
  );
}

const EQUIPMENT_TYPE_LABELS: Record<GSEEquipmentType, string> = {
  tug: "Tug",
  gpu: "GPU",
  deice_truck: "Deice Truck",
  belt_loader: "Belt Loader",
  fuel_truck: "Fuel Truck",
  lavatory: "Lavatory",
  air_start: "Air Start",
  heater: "Heater",
  other: "Other",
};

function Header({ unit }: { unit: GSEUnitListItem }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{unit.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {EQUIPMENT_TYPE_LABELS[unit.equipment_type]}
          {unit.station && (
            <>
              <span className="mx-2">·</span>
              <span className="font-mono">{unit.station.icao_code}</span>
            </>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <UnitStatusChip status={unit.status} size="lg" />
        <ChangeStatusDialog unitId={unit.id} currentStatus={unit.status} />
      </div>
    </div>
  );
}

function Meta({ unit }: { unit: GSEUnitListItem }) {
  const makeModel = [unit.make, unit.model].filter(Boolean).join(" ") || "—";
  return (
    <div className="mb-6 rounded-lg border border-border bg-card p-4">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
        <Field label="Make / Model" value={makeModel} />
        <Field label="Serial" value={unit.serial_number ?? "—"} />
        <Field label="Year" value={unit.year ? String(unit.year) : "—"} />
        <Field
          label="Hours"
          value={unit.hours_total.toLocaleString()}
        />
        <Field
          label="Last service"
          value={unit.last_service_date ?? "—"}
        />
        <Field
          label="Next service"
          value={unit.next_service_date ?? "—"}
        />
        <Field
          label="Interval (days)"
          value={
            unit.service_interval_days
              ? String(unit.service_interval_days)
              : "—"
          }
        />
        <Field
          label="Manufacturer"
          value={unit.manufacturer ?? "—"}
        />
      </dl>
      {unit.status_note && (
        <p className="mt-3 whitespace-pre-wrap border-t border-border pt-3 text-sm text-status-yellow">
          {unit.status_note}
        </p>
      )}
      {unit.notes && (
        <p className="mt-3 whitespace-pre-wrap border-t border-border pt-3 text-sm text-foreground">
          {unit.notes}
        </p>
      )}
    </div>
  );
}

function MaintenanceSection({
  unitId,
  unitHours,
  items,
}: {
  unitId: string;
  unitHours: number;
  items: GSEMaintenanceItemResponse[];
}) {
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          Scheduled maintenance ({items.length})
        </h2>
        <ScheduleMaintenanceDialog unitId={unitId} />
      </div>
      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-card/40 px-4 py-8 text-center text-xs text-muted-foreground">
          No scheduled maintenance items. Use the + Schedule MX button
          above to add one.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Interval</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((mx) => (
                <tr
                  key={mx.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold text-foreground">
                      {mx.title}
                    </div>
                    {mx.description && (
                      <div className="text-xs text-muted-foreground">
                        {mx.description}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {mx.item_type}
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground">
                    {[
                      mx.interval_days ? `${mx.interval_days} d` : null,
                      mx.interval_hours ? `${mx.interval_hours} h` : null,
                    ]
                      .filter(Boolean)
                      .join(" / ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground">
                    {[
                      mx.due_date ?? null,
                      mx.due_hours !== null ? `${mx.due_hours} h` : null,
                    ]
                      .filter(Boolean)
                      .join(" / ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <MxStatusChip status={mx.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <CompleteMaintenanceButton
                      unitId={unitId}
                      mxId={mx.id}
                      mxTitle={mx.title}
                      unitHours={unitHours}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SquawksSection({
  unitId,
  title,
  squawks,
  emptyHint,
  showReportButton = false,
  showResolve = false,
}: {
  unitId: string;
  title: string;
  squawks: GSESquawkResponse[];
  emptyHint: string;
  showReportButton?: boolean;
  showResolve?: boolean;
}) {
  return (
    <section className="mb-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {showReportButton && <ReportSquawkDialog unitId={unitId} />}
      </div>
      {squawks.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-card/40 px-4 py-8 text-center text-xs text-muted-foreground">
          {emptyHint}
        </div>
      ) : (
        <ul className="space-y-2">
          {squawks.map((sq) => (
            <li
              key={sq.id}
              className="rounded-lg border border-border bg-card p-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm text-foreground">{sq.description}</p>
                <div className="flex items-center gap-2">
                  <SquawkStatusChip status={sq.status} />
                  {showResolve && sq.status !== "resolved" && (
                    <ResolveSquawkButton
                      unitId={unitId}
                      squawkId={sq.id}
                      squawkSummary={sq.description}
                    />
                  )}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.65rem] text-muted-foreground">
                <span>
                  <span className="font-semibold uppercase tracking-[0.05em]">
                    Reported
                  </span>{" "}
                  {sq.reported_date}
                  {sq.reported_by && ` by ${sq.reported_by.full_name}`}
                </span>
                {sq.resolved_date && (
                  <span>
                    <span className="font-semibold uppercase tracking-[0.05em]">
                      Resolved
                    </span>{" "}
                    {sq.resolved_date}
                    {sq.resolved_by && ` by ${sq.resolved_by.full_name}`}
                  </span>
                )}
              </div>
              {sq.resolution_notes && (
                <p className="mt-2 rounded-md border border-status-green/30 bg-status-green/5 p-2 text-xs text-foreground">
                  {sq.resolution_notes}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MxStatusChip({ status }: { status: GSEMxStatus }) {
  const map: Record<GSEMxStatus, string> = {
    current: "border-status-green/40 bg-status-green/10 text-status-green",
    due_soon:
      "border-status-yellow/40 bg-status-yellow/10 text-status-yellow",
    overdue: "border-status-red/40 bg-status-red/10 text-status-red",
  };
  return (
    <span
      className={`rounded-md border px-2 py-0.5 text-[0.6rem] font-semibold uppercase ${map[status]}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function SquawkStatusChip({ status }: { status: GSESquawkResponse["status"] }) {
  const map: Record<GSESquawkResponse["status"], string> = {
    open: "border-status-red/40 bg-status-red/10 text-status-red",
    in_progress:
      "border-status-yellow/40 bg-status-yellow/10 text-status-yellow",
    resolved: "border-status-green/40 bg-status-green/10 text-status-green",
  };
  return (
    <span
      className={`rounded-md border px-2 py-0.5 text-[0.6rem] font-semibold uppercase ${map[status]}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function UnitStatusChip({
  status,
  size,
}: {
  status: GSEUnitStatus;
  size?: "lg";
}) {
  const map: Record<GSEUnitStatus, string> = {
    operational:
      "border-status-green/40 bg-status-green/10 text-status-green",
    maintenance:
      "border-status-yellow/40 bg-status-yellow/10 text-status-yellow",
    out_of_service:
      "border-status-red/40 bg-status-red/10 text-status-red",
  };
  const sizing =
    size === "lg" ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[0.6rem]";
  return (
    <span
      className={`rounded-md border font-semibold uppercase ${sizing} ${map[status]}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </dt>
      <dd className="m-0 mt-0.5 font-mono text-sm text-foreground">{value}</dd>
    </div>
  );
}
