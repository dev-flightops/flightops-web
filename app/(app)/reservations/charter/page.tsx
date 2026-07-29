import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import {
  CHARTER_STATUS_LABELS,
  type CharterRow,
  type CharterStatus,
  listCharters,
} from "@/lib/api/charter";
import { listCustomers, type Customer } from "@/lib/api/reservations";

import { NewCharterToggle } from "./new-charter-toggle";
import { TransitionButtons } from "./transition-buttons";

/**
 * /reservations/charter — Charter Pipeline.
 *
 * Legacy peregrineflight.com/charter renders a status-tabbed list
 * of CharterRequest rows through the pipeline: request → quoted →
 * confirmed → dispatched → completed (cancellable from every
 * non-terminal state). Backend endpoints ship in
 * flightops-services PR #119.
 *
 * Tabs mirror the six statuses plus an "All" bucket. Per-row
 * actions show only the legal forward transitions + Cancel.
 */

export const dynamic = "force-dynamic";

const STATUS_TABS: readonly {
  value: CharterStatus | "";
  label: string;
}[] = [
  { value: "", label: "All" },
  { value: "request", label: "Request" },
  { value: "quoted", label: "Quoted" },
  { value: "confirmed", label: "Confirmed" },
  { value: "dispatched", label: "Dispatched" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function parseStatus(v: string | string[] | undefined): CharterStatus | "" {
  const s = Array.isArray(v) ? v[0] : v;
  if (
    s === "request" ||
    s === "quoted" ||
    s === "confirmed" ||
    s === "dispatched" ||
    s === "completed" ||
    s === "cancelled"
  ) {
    return s;
  }
  return "";
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

function charterRef(id: string): string {
  return `CHR-${id.slice(0, 8).toUpperCase()}`;
}

export default async function CharterPipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const params = await searchParams;
  const active = parseStatus(params.status);

  let rows: CharterRow[] = [];
  let customers: Customer[] = [];
  let loadError: string | null = null;
  try {
    const [charters, custList] = await Promise.all([
      listCharters(active ? { status: active as CharterStatus } : {}),
      listCustomers({ limit: 200 }),
    ]);
    rows = charters.items;
    customers = custList.items;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Charter pipeline unavailable. Try refreshing in a moment.";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Charter Pipeline</h1>
        {loadError ? null : <NewCharterToggle customers={customers} />}
      </header>

      <div className="mb-5 flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => {
          const isActive = t.value === active;
          const href =
            t.value === ""
              ? "/reservations/charter"
              : `/reservations/charter?status=${t.value}`;
          return (
            <Link
              key={t.label}
              href={href}
              className={
                "rounded-lg border border-border px-3 py-1.5 text-xs " +
                (isActive
                  ? "bg-muted/40 font-bold text-foreground"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {loadError ? (
        <div
          role="alert"
          className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-3 text-xs text-status-yellow"
        >
          {loadError}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-8 text-center text-sm text-muted-foreground">
          {active
            ? `No charter requests with status "${CHARTER_STATUS_LABELS[active]}".`
            : "No charter requests found. Click + New Charter Request to file one."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/10 text-left text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Ref</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Customer</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Route</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Date</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Pax</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Aircraft</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/5">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-status-blue">
                      {charterRef(c.id)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {c.customer_name ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                      {c.origin_icao} → {c.destination_icao}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(c.requested_date)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                      {c.pax_count}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {c.aircraft_type_requested ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <CharterStatusBadge status={c.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <TransitionButtons
                        charterId={c.id}
                        currentStatus={c.status}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function CharterStatusBadge({ status }: { status: CharterStatus }) {
  const map: Record<CharterStatus, [string, string]> = {
    request: [
      "border-border bg-muted/20 text-muted-foreground",
      "Request",
    ],
    quoted: [
      "border-status-blue/40 bg-status-blue/10 text-status-blue",
      "Quoted",
    ],
    confirmed: [
      "border-status-yellow/40 bg-status-yellow/10 text-status-yellow",
      "Confirmed",
    ],
    dispatched: [
      "border-status-blue/40 bg-status-blue/10 text-status-blue",
      "Dispatched",
    ],
    completed: [
      "border-status-green/40 bg-status-green/10 text-status-green",
      "Completed",
    ],
    cancelled: [
      "border-status-red/40 bg-status-red/10 text-status-red",
      "Cancelled",
    ],
  };
  const [cls, label] = map[status];
  return (
    <span
      className={
        "rounded border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider " +
        cls
      }
    >
      {label}
    </span>
  );
}
