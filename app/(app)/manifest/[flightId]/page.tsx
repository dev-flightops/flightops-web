import Link from "next/link";
import { notFound } from "next/navigation";

import { ApiError } from "@/lib/api/client";
import { getFlight } from "@/lib/api/ops";
import {
  getFlightManifest,
  type ManifestDetailResponse,
} from "@/lib/api/manifest";
import type { FlightDetail, FlightStatus } from "@/lib/api/types";

export const dynamic = "force-dynamic";

/**
 * /manifest/[flightId] — passenger + cargo manifest for a single flight.
 *
 * Reached from the /manifest schedule board. Renders three blocks:
 *   1. Flight headline (flight #, route, aircraft, status)
 *   2. Totals strip (pax counts, weights, payload vs aircraft max)
 *   3. Pax table + Cargo table
 *
 * When the flight has no manifest yet the endpoint returns 404 — we
 * show a helpful empty state rather than redirecting; the dispatcher
 * decides when to create one.
 */
export default async function FlightManifestPage({
  params,
}: {
  params: Promise<{ flightId: string }>;
}) {
  const { flightId } = await params;

  let flight: FlightDetail;
  try {
    flight = await getFlight(flightId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  let manifest: ManifestDetailResponse | null = null;
  try {
    manifest = await getFlightManifest(flightId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      manifest = null;
    } else {
      throw err;
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 text-xs">
        <Link
          href="/manifest"
          className="text-muted-foreground hover:text-foreground"
        >
          ← Flight Schedule
        </Link>
      </div>

      <FlightHeader flight={flight} />

      {manifest ? (
        <>
          <TotalsStrip
            totals={manifest.totals}
            maxPayloadLbs={flight.max_payload_lbs}
          />

          <div className="mt-6 grid gap-6">
            <PaxCard rows={manifest.pax} />
            <CargoCard rows={manifest.cargo} />
          </div>

          <ManifestMeta manifest={manifest} />
        </>
      ) : (
        <EmptyState flightId={flight.id} />
      )}
    </div>
  );
}

function FlightHeader({ flight }: { flight: FlightDetail }) {
  return (
    <header className="mb-6 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
          Passenger Manifest
        </div>
        <h1 className="mt-0.5 text-2xl font-bold sm:text-3xl">
          {flight.flight_number}
        </h1>
        <div className="mt-1 font-mono text-sm text-muted-foreground">
          {flight.origin} → {flight.destination}
          <span className="mx-2 text-muted-foreground/40">·</span>
          {flight.aircraft.tail_number}
          {flight.aircraft.model ? (
            <span className="text-muted-foreground/70"> · {flight.aircraft.model}</span>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <FlightStatusBadge status={flight.status} />
        <Link
          href={`/dispatch?flight=${flight.id}`}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-muted/20"
        >
          Open Dispatch Packet →
        </Link>
      </div>
    </header>
  );
}

function TotalsStrip({
  totals,
  maxPayloadLbs,
}: {
  totals: ManifestDetailResponse["totals"];
  maxPayloadLbs: number | null;
}) {
  const totalPayload = Number(totals.total_payload_lbs);
  const headroom =
    maxPayloadLbs != null ? maxPayloadLbs - totalPayload : null;
  const overWeight = headroom != null && headroom < 0;

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      <Stat value={totals.pax_count} label="Passengers" />
      <Stat value={totals.revenue_pax} label="Revenue" />
      <Stat value={totals.crew_count} label="Crew" />
      <Stat
        value={`${fmtLbs(totals.pax_weight_lbs)} lb`}
        label="Pax Weight"
      />
      <Stat
        value={`${fmtLbs(totals.baggage_weight_lbs)} lb`}
        label="Baggage"
      />
      <Stat
        value={`${fmtLbs(totals.cargo_weight_lbs)} lb`}
        label="Cargo"
      />
      <Stat
        value={`${fmtLbs(totals.mail_weight_lbs)} lb`}
        label="Mail"
      />
      <Stat
        value={`${fmtLbs(totals.total_payload_lbs)} lb`}
        label="Total Payload"
        emphasis
      />
      {maxPayloadLbs != null && (
        <>
          <Stat
            value={`${maxPayloadLbs.toLocaleString()} lb`}
            label="Aircraft Max"
          />
          <Stat
            value={`${headroom!.toLocaleString()} lb`}
            label={overWeight ? "Over Max" : "Headroom"}
            valueClass={
              overWeight
                ? "text-status-red"
                : headroom! < 200
                  ? "text-status-yellow"
                  : "text-status-green"
            }
          />
        </>
      )}
    </div>
  );
}

function Stat({
  value,
  label,
  valueClass = "",
  emphasis = false,
}: {
  value: string | number;
  label: string;
  valueClass?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={
        "rounded-lg border bg-card px-3 py-2.5 " +
        (emphasis ? "border-status-blue/40 bg-status-blue/5" : "border-border")
      }
    >
      <div
        className={
          "text-lg font-bold " + (valueClass || "text-foreground")
        }
      >
        {value}
      </div>
      <div className="mt-0.5 text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function PaxCard({ rows }: { rows: ManifestDetailResponse["pax"] }) {
  const sorted = [...rows].sort((a, b) => {
    const sa = a.seat_number ?? "";
    const sb = b.seat_number ?? "";
    if (sa && sb) return sa.localeCompare(sb, undefined, { numeric: true });
    if (sa) return -1;
    if (sb) return 1;
    return a.last_name.localeCompare(b.last_name);
  });

  return (
    <section>
      <div className="mb-2 flex items-baseline gap-2 px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Passengers
        </h2>
        <span className="text-xs text-muted-foreground/60">
          {rows.length} on board
        </span>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            No passengers on this manifest.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/10 text-left text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Seat</th>
                  <th className="px-3 py-2.5 font-semibold">Last</th>
                  <th className="px-3 py-2.5 font-semibold">First</th>
                  <th className="px-3 py-2.5 font-semibold">Ticket</th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    Weight
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    Baggage
                  </th>
                  <th className="px-3 py-2.5 font-semibold">Flags</th>
                  <th className="px-3 py-2.5 font-semibold">Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/5">
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs">
                      {p.seat_number ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium">
                      {p.last_name}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      {p.first_name}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <TicketBadge ticket={p.ticket_type} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-xs">
                      {fmtLbs(p.weight_lbs)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-xs">
                      {fmtLbs(p.baggage_lbs)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {p.is_crew && <Flag label="CREW" tone="blue" />}
                        {p.is_unaccompanied_minor && (
                          <Flag label="UM" tone="yellow" />
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                      {p.contact_phone ?? p.contact_email ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function CargoCard({ rows }: { rows: ManifestDetailResponse["cargo"] }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline gap-2 px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Cargo & Mail
        </h2>
        <span className="text-xs text-muted-foreground/60">
          {rows.length} item{rows.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            No cargo or mail on this manifest.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/10 text-left text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Description</th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    Pieces
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    Weight
                  </th>
                  <th className="px-3 py-2.5 font-semibold">Class</th>
                  <th className="px-3 py-2.5 font-semibold">Shipper</th>
                  <th className="px-3 py-2.5 font-semibold">Consignee</th>
                  <th className="px-3 py-2.5 font-semibold">Tracking</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/5">
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{c.description}</div>
                      {c.hazmat_notes && (
                        <div className="mt-0.5 text-xs text-status-red/90">
                          {c.hazmat_notes}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-xs">
                      {c.pieces}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-xs">
                      {fmtLbs(c.weight_lbs)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {c.mail_class && (
                          <MailBadge mailClass={c.mail_class} />
                        )}
                        {c.is_hazmat && <Flag label="HAZMAT" tone="red" />}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                      {c.shipper ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                      {c.consignee ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-muted-foreground">
                      {c.tracking_number ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function ManifestMeta({ manifest }: { manifest: ManifestDetailResponse }) {
  return (
    <div className="mt-6 rounded-lg border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        <div>
          <span className="uppercase tracking-wider">Status</span>{" "}
          <span className="font-mono text-foreground">{manifest.status}</span>
        </div>
        {manifest.locked_at && (
          <div>
            <span className="uppercase tracking-wider">Locked</span>{" "}
            <span className="font-mono text-foreground">
              {new Date(manifest.locked_at).toLocaleString("en-US", {
                timeZone: "UTC",
              })}{" "}
              UTC
            </span>
          </div>
        )}
      </div>
      {manifest.notes && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/80">
          {manifest.notes}
        </p>
      )}
    </div>
  );
}

function EmptyState({ flightId }: { flightId: string }) {
  return (
    <div className="rounded-lg border border-border bg-card py-16 text-center">
      <p className="mb-2 text-sm font-medium text-foreground">
        No manifest created for this flight yet.
      </p>
      <p className="mx-auto mb-5 max-w-md text-xs text-muted-foreground">
        A dispatcher creates the manifest before adding passengers, cargo, or
        mail. Once created, this page will show the full pax roster, cargo
        list, and payload totals.
      </p>
      <Link
        href={`/dispatch?flight=${flightId}`}
        className="inline-block rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground/80 hover:bg-muted/20"
      >
        Open Dispatch Packet →
      </Link>
    </div>
  );
}

function TicketBadge({ ticket }: { ticket: string }) {
  const map: Record<string, [string, string]> = {
    revenue: ["border-status-blue/40 bg-status-blue/10 text-status-blue", "Revenue"],
    comp: ["border-status-yellow/40 bg-status-yellow/10 text-status-yellow", "Comp"],
    employee: ["border-status-green/40 bg-status-green/10 text-status-green", "Employee"],
    standby: ["border-border bg-muted/20 text-muted-foreground", "Standby"],
    cargo_only: ["border-border bg-muted/20 text-muted-foreground", "Cargo Only"],
  };
  const [cls, label] = map[ticket] ?? [
    "border-border bg-muted/20 text-muted-foreground",
    ticket,
  ];
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

function MailBadge({ mailClass }: { mailClass: string }) {
  const label = mailClass
    .split("_")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
  return (
    <span className="rounded border border-status-blue/40 bg-status-blue/10 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-status-blue">
      {label}
    </span>
  );
}

function Flag({
  label,
  tone,
}: {
  label: string;
  tone: "blue" | "yellow" | "red" | "green";
}) {
  const map: Record<typeof tone, string> = {
    blue: "border-status-blue/40 bg-status-blue/10 text-status-blue",
    yellow: "border-status-yellow/40 bg-status-yellow/10 text-status-yellow",
    red: "border-status-red/40 bg-status-red/10 text-status-red",
    green: "border-status-green/40 bg-status-green/10 text-status-green",
  };
  return (
    <span
      className={
        "rounded border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider " +
        map[tone]
      }
    >
      {label}
    </span>
  );
}

function FlightStatusBadge({ status }: { status: FlightStatus }) {
  const map: Record<FlightStatus, [string, string]> = {
    scheduled: ["border-border bg-muted/20 text-muted-foreground", "Scheduled"],
    released: [
      "border-status-blue/40 bg-status-blue/10 text-status-blue",
      "Released",
    ],
    completed: [
      "border-status-green/40 bg-status-green/10 text-status-green",
      "Completed",
    ],
    cancelled: [
      "border-status-yellow/40 bg-status-yellow/10 text-status-yellow",
      "Cancelled",
    ],
  };
  const [cls, label] = map[status];
  return (
    <span
      className={
        "rounded border px-2 py-0.5 text-xs font-semibold uppercase tracking-wider " +
        cls
      }
    >
      {label}
    </span>
  );
}

function fmtLbs(v: string | number): string {
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString();
}
