import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import { listGseUnits } from "@/lib/api/ground";
import type {
  GSEEquipmentType,
  GSEUnitListItem,
  GSEUnitStatus,
} from "@/lib/api/types";

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

  const hasFiltersApplied = Boolean(status || type || stationFilter);
  const totalUnits = units.length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight">
            Ground Support Equipment
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Equipment inventory, status, and service tracking
          </p>
        </div>
        <button
          type="button"
          disabled
          title="Coming in M2"
          className="cursor-not-allowed rounded-md border border-status-blue bg-status-blue/15 px-3 py-1.5 text-xs font-semibold text-status-blue opacity-70"
        >
          + Add Equipment
        </button>
      </header>

      {loadError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
        >
          {loadError}
        </div>
      )}

      <Stats stats={stats} />
      <Filters
        status={status}
        type={type}
        stationFilter={stationFilter}
        stations={stationsInUse}
      />

      {filtered.length === 0 ? (
        totalUnits === 0 && !hasFiltersApplied ? (
          <EmptyState />
        ) : (
          <div className="rounded-lg border border-border bg-card px-4 py-16 text-center">
            <p className="text-sm text-muted-foreground">
              No equipment matches the current filters.
            </p>
          </div>
        )
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
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-16 text-center">
      <p className="mb-4 text-sm text-muted-foreground">
        No equipment tracked yet.
      </p>
      <button
        type="button"
        disabled
        title="Coming in M2"
        className="cursor-not-allowed rounded-md border border-status-blue bg-status-blue/15 px-4 py-2 text-xs font-semibold text-status-blue opacity-70"
      >
        Add First Unit
      </button>
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
  // Tones are persistent per-category (matches legacy gse/dashboard.html
  // where Operational stays green / In Maintenance stays yellow / Needs
  // Attention stays red even at zero) — they communicate severity-class,
  // not "is currently a problem".
  return (
    <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Tile label="Total Units" value={stats.total} />
      <Tile label="Operational" value={stats.operational} tone="green" />
      <Tile
        label="In Maintenance"
        value={stats.maintenance}
        tone="yellow"
      />
      <Tile
        label="Needs Attention"
        value={stats.needsAttention}
        tone="red"
      />
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
    <div className="rounded-lg border border-border bg-card px-4 py-3 text-center">
      <div className={`text-2xl font-bold leading-none ${cls}`}>{value}</div>
      <div className="mt-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
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
      <button
        type="submit"
        className="rounded-md border border-border bg-card/60 px-3 py-2 text-xs font-semibold text-foreground hover:bg-border/40"
      >
        Filter
      </button>
      {(status || type || stationFilter) && (
        <Link
          href="/equipment"
          className="text-xs font-semibold text-status-red hover:underline"
        >
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
      <span className="text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </span>
      <select
        name={name}
        defaultValue={value}
        className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-blue focus:outline-none"
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
            <tr className="border-b border-border text-left text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Make / Model</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Next Service</th>
              <th className="px-4 py-3 text-center">Squawks</th>
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
          <span className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-2 py-0.5 text-[0.65rem] font-semibold text-status-yellow">
            {unit.open_squawk_count} open
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          href={`/equipment/${unit.id}`}
          className="text-sm font-medium text-status-blue hover:underline"
        >
          View →
        </Link>
      </td>
    </tr>
  );
}

function UnitStatusChip({ status }: { status: GSEUnitStatus }) {
  const map: Record<GSEUnitStatus, string> = {
    operational:
      "border-status-green/40 bg-status-green/10 text-status-green",
    maintenance:
      "border-status-yellow/40 bg-status-yellow/10 text-status-yellow",
    out_of_service:
      "border-status-red/40 bg-status-red/10 text-status-red",
  };
  return (
    <span
      className={`rounded-md border px-2 py-0.5 text-[0.6rem] font-semibold uppercase ${map[status]}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}
