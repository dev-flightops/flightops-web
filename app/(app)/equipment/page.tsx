import Link from "next/link";

import { auth } from "@/auth";
import { buttonOutline, linkCaps } from "@/components/ff/controls";
import { ApiError } from "@/lib/api/client";
import { listGseUnits } from "@/lib/api/ground";
import type {
  GSEEquipmentType,
  GSEUnitListItem,
  GSEUnitStatus,
} from "@/lib/api/types";
import { GSE_WRITERS, hasAnyRole } from "@/lib/roles";

/**
 * /equipment — GSE landing (M2-G-39).
 *
 * Mirrors legacy `templates/gse/dashboard.html`:
 *   - Title + subtitle ("Equipment inventory, status, and service tracking")
 *   - 4-tile stats strip: Total · Operational · In Maintenance · Needs Attention
 *   - Table grouped by station, ordered by station ICAO then unit name
 *   - Status pill per row + open-squawk chip
 *
 * Filter state lives in the URL (?status=, ?type=, ?station=) so the
 * page is shareable + survives nav. Add/edit forms land in M2-G-39b.
 */

const UNITS_LIMIT = 500;

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

const ALLOWED_STATUSES: GSEUnitStatus[] = [
  "operational",
  "maintenance",
  "out_of_service",
];

const ALLOWED_TYPES = Object.keys(EQUIPMENT_TYPE_LABELS) as GSEEquipmentType[];

function parseStatus(raw: unknown): GSEUnitStatus | undefined {
  return typeof raw === "string" && (ALLOWED_STATUSES as string[]).includes(raw)
    ? (raw as GSEUnitStatus)
    : undefined;
}

function parseType(raw: unknown): GSEEquipmentType | undefined {
  return typeof raw === "string" && (ALLOWED_TYPES as string[]).includes(raw)
    ? (raw as GSEEquipmentType)
    : undefined;
}

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    type?: string;
    station?: string;
  }>;
}) {
  const params = await searchParams;
  // Adding equipment is station staff's, the DOM's and management's
  // (GSE_WRITERS, enforced by the backend since 29 Sep).
  const canAdd = hasAnyRole((await auth())?.roles ?? [], GSE_WRITERS);
  const status = parseStatus(params.status);
  const type = parseType(params.type);

  let units: GSEUnitListItem[] = [];
  let loadError: string | null = null;

  try {
    units = (
      await listGseUnits({
        status,
        equipmentType: type,
        limit: UNITS_LIMIT,
      })
    ).items;
  } catch (err) {
    const apiStatus = err instanceof ApiError ? err.status : 0;
    loadError =
      apiStatus === 401
        ? "Your session expired — please sign in again."
        : "Equipment feed unavailable. Try refreshing in a moment.";
  }

  // Client-side station filter — the backend takes station_id (UUID), but
  // the filter row uses ICAO, which is what shows up on the units. Server-
  // side filtering by station ICAO would need a join we haven't built; for
  // a few-hundred-unit fleet the in-memory cut is fine.
  const stationFilter = params.station?.trim().toUpperCase() || undefined;
  const filtered = stationFilter
    ? units.filter((u) => u.station?.icao_code === stationFilter)
    : units;

  const stats = computeStats(units);
  const stationsInUse = Array.from(
    new Set(units.map((u) => u.station?.icao_code).filter(Boolean) as string[]),
  ).sort();

  const grouped = groupByStation(filtered);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="page-title">
            Ground Support Equipment
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Equipment inventory, status, and service tracking
          </p>
        </div>
        {canAdd ? (
          <Link
            href="/equipment/new"
            className="btn-caps rounded-md border border-primary/40 bg-background px-3 py-1.5 text-primary hover:bg-primary/5 text-[0.72rem]"
          >
            + Add Equipment
          </Link>
        ) : null}
      </header>

      {loadError ? (
        <div
          role="alert"
          className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      ) : (
        <>
          <Stats stats={stats} />
          <Filters
            status={status}
            type={type}
            stationFilter={stationFilter}
            stations={stationsInUse}
          />
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-border bg-card px-4 py-16 text-center">
              {units.length === 0 ? (
                <>
                  {/* True empty state — no equipment in the DB.
                      Matches legacy peregrineflight's CTA-anchored
                      message; "Add First Unit" deep-links to the same
                      create form as the header "+ Add Equipment". */}
                  <p className="mb-4 text-sm text-muted-foreground">
                    No equipment tracked yet.
                  </p>
                  {canAdd ? (
                    <Link
                      href="/equipment/new"
                      className="btn-caps inline-block rounded-md border border-primary/40 bg-background px-4 py-2 text-primary hover:bg-primary/5 text-[0.72rem]"
                    >
                      + Add First Unit
                    </Link>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Ground Ops, the Director of Maintenance, the Director of
                      Operations or an Exec Admin adds equipment.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No equipment matches the current filters.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {Object.entries(grouped).map(([station, list]) => (
                <StationGroup
                  key={station}
                  stationLabel={station}
                  units={list}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function computeStats(units: GSEUnitListItem[]) {
  let operational = 0;
  let maintenance = 0;
  let outOfService = 0;
  for (const u of units) {
    if (u.status === "operational") operational += 1;
    else if (u.status === "maintenance") maintenance += 1;
    else if (u.status === "out_of_service") outOfService += 1;
  }
  return {
    total: units.length,
    operational,
    maintenance,
    needsAttention: outOfService + maintenance,
  };
}

function groupByStation(
  units: GSEUnitListItem[],
): Record<string, GSEUnitListItem[]> {
  const out: Record<string, GSEUnitListItem[]> = {};
  for (const u of units) {
    const key = u.station?.icao_code ?? "Unassigned";
    if (!out[key]) out[key] = [];
    out[key].push(u);
  }
  // Within each group, order by name (server already does this; preserved
  // for any client-side re-sort).
  for (const key of Object.keys(out)) {
    out[key].sort((a, b) => a.name.localeCompare(b.name));
  }
  return out;
}

function Stats({
  stats,
}: {
  stats: ReturnType<typeof computeStats>;
}) {
  return (
    <section className="mb-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
      <Tile label="Total Units" value={stats.total} />
      <Tile
        label="Operational"
        value={stats.operational}
        tone="green"
      />
      {/* Category tone is always applied — matches legacy
          peregrineflight's "In Maintenance=yellow, Needs Attention=red"
          even when the count is 0, so the tile reads as the
          *category color* (what it would look like populated) rather
          than as a neutral counter that only lights up under threat. */}
      <Tile label="In Maintenance" value={stats.maintenance} tone="yellow" />
      <Tile label="Needs Attention" value={stats.needsAttention} tone="red" />
    </section>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "green" | "yellow" | "red";
}) {
  const cls =
    tone === "green"
      ? "text-status-green"
      : tone === "yellow"
        ? "text-status-yellow"
        : tone === "red"
          ? "text-status-red"
          : "text-foreground";
  return (
    <div className="flex min-w-0 flex-col border-l-2 border-input py-1 pl-3">
      <div className={`font-display text-[1.75rem] font-extrabold leading-none tabular-nums ${cls}`}>{value}</div>
      <div className="eyebrow mt-1.5">
        {label}
      </div>
    </div>
  );
}

function Filters({
  status,
  type,
  stationFilter,
  stations,
}: {
  status: GSEUnitStatus | undefined;
  type: GSEEquipmentType | undefined;
  stationFilter: string | undefined;
  stations: string[];
}) {
  return (
    <form
      method="get"
      className="mb-5 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3"
    >
      <FilterSelect
        name="station"
        label="Station"
        value={stationFilter ?? ""}
        options={[
          { value: "", label: "All" },
          ...stations.map((s) => ({ value: s, label: s })),
        ]}
      />
      <FilterSelect
        name="status"
        label="Status"
        value={status ?? ""}
        options={[
          { value: "", label: "All" },
          { value: "operational", label: "Operational" },
          { value: "maintenance", label: "Maintenance" },
          { value: "out_of_service", label: "Out of service" },
        ]}
      />
      <FilterSelect
        name="type"
        label="Type"
        value={type ?? ""}
        options={[
          { value: "", label: "All" },
          ...ALLOWED_TYPES.map((t) => ({
            value: t,
            label: EQUIPMENT_TYPE_LABELS[t],
          })),
        ]}
      />
      <button type="submit" className={buttonOutline}>
        Filter
      </button>
      {(status || type || stationFilter) && (
        <Link href="/equipment" className={linkCaps}>
          Clear
        </Link>
      )}
    </form>
  );
}

function FilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex min-w-[140px] flex-col gap-1">
      <span className="eyebrow">
        {label}
      </span>
      <select
        name={name}
        defaultValue={value}
        className="ff-input px-3 py-2 text-sm w-auto"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function StationGroup({
  stationLabel,
  units,
}: {
  stationLabel: string;
  units: GSEUnitListItem[];
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold tracking-wide text-foreground">
        {stationLabel}
      </h2>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left eyebrow">
              {/* Shared widths, so the stations' tables line up down the page. */}
              <th className="w-[22%] px-4 py-3">Unit</th>
              <th className="w-[12%] px-4 py-3">Type</th>
              <th className="w-[18%] px-4 py-3">Make / Model</th>
              <th className="w-[16%] px-4 py-3">Status</th>
              <th className="w-[12%] px-4 py-3">Next Service</th>
              <th className="w-[10%] px-4 py-3 text-center">Squawks</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {units.map((u) => (
              <UnitRow key={u.id} unit={u} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UnitRow({ unit }: { unit: GSEUnitListItem }) {
  const makeModel = [unit.make, unit.model].filter(Boolean).join(" ") || "—";
  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-3 font-semibold text-foreground">{unit.name}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {EQUIPMENT_TYPE_LABELS[unit.equipment_type]}
      </td>
      <td className="px-4 py-3 text-xs text-foreground">{makeModel}</td>
      <td className="px-4 py-3">
        <UnitStatusChip status={unit.status} />
      </td>
      <td className="px-4 py-3 text-xs text-foreground">
        {unit.next_service_date ?? "—"}
      </td>
      <td className="px-4 py-3 text-center">
        {unit.open_squawk_count > 0 ? (
          <span className="status-mark text-status-yellow">
            {unit.open_squawk_count} open
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <Link href={`/equipment/${unit.id}`} className={linkCaps}>
          View <span aria-hidden>›</span>
        </Link>
      </td>
    </tr>
  );
}

function UnitStatusChip({ status }: { status: GSEUnitStatus }) {
  const map: Record<GSEUnitStatus, string> = {
    operational: "text-status-green",
    maintenance: "text-status-yellow",
    out_of_service: "text-status-red",
  };
  return (
    <span className={`status-mark ${map[status]}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}
