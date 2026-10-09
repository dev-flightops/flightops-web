import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { ApiError } from "@/lib/api/client";
import { getFlight } from "@/lib/api/ops";
import {
  getFlightManifest,
  type ManifestDetailResponse,
} from "@/lib/api/manifest";
import type { FlightDetail, FlightStatus } from "@/lib/api/types";
import { hasAnyRole, MANIFEST_LOCKERS } from "@/lib/roles";

import { FreightSection } from "./freight-section";
import { CreateManifestButton, LockManifestButton } from "./manifest-controls";
import { fmtLbs } from "./manifest-bits";
import { PassengersSection } from "./pax-section";

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
 *
 * Entry (#62): while the manifest is a draft anyone on staff adds, edits
 * and removes passengers, mail and cargo, as legacy's manifest page lets
 * them. Locking it is final and is the check-in roles' (MANIFEST_LOCKERS),
 * legacy's close-boarding roles.
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

  const editable = manifest?.status === "draft";
  const canLock = editable && hasAnyRole((await auth())?.roles ?? [], MANIFEST_LOCKERS);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <div className="mb-4 text-xs">
        <Link
          href="/manifest"
          className="text-muted-foreground hover:text-foreground"
        >
          ← Flight Schedule
        </Link>
      </div>

      <FlightHeader
        flight={flight}
        lock={canLock ? <LockManifestButton flightId={flight.id} flightNumber={flight.flight_number} /> : null}
      />

      {manifest ? (
        <>
          {manifest.status === "final" ? <LockedBanner manifest={manifest} /> : null}

          <TotalsStrip
            totals={manifest.totals}
            maxPayloadLbs={flight.max_payload_lbs}
          />

          <div className="mt-6 grid gap-6">
            <PassengersSection flightId={flight.id} rows={manifest.pax} editable={editable} />
            <FreightSection
              flightId={flight.id}
              kind="mail"
              rows={manifest.cargo.filter((c) => c.mail_class !== null)}
              editable={editable}
            />
            <FreightSection
              flightId={flight.id}
              kind="cargo"
              rows={manifest.cargo.filter((c) => c.mail_class === null)}
              editable={editable}
            />
          </div>

          <ManifestMeta manifest={manifest} />
        </>
      ) : (
        <EmptyState flightId={flight.id} />
      )}
    </div>
  );
}

function LockedBanner({ manifest }: { manifest: ManifestDetailResponse }) {
  return (
    <div
      role="status"
      className="mb-6 rounded-lg border border-status-green/40 bg-status-green/10 px-4 py-3 text-sm text-status-green"
    >
      <span className="font-semibold">Manifest locked.</span>{" "}
      {manifest.locked_at
        ? `Final since ${new Date(manifest.locked_at).toLocaleString("en-US", { timeZone: "UTC" })} UTC; it can't be changed.`
        : "It is final and can't be changed."}
    </div>
  );
}

function FlightHeader({
  flight,
  lock,
}: {
  flight: FlightDetail;
  lock: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
          Passenger Manifest
        </div>
        <h1 className="mt-0.5 text-2xl font-bold tracking-tight">
          {flight.flight_number}
        </h1>
        <div className="mt-1 font-mono text-sm text-muted-foreground">
          {flight.origin} → {flight.destination}
          <span className="mx-2 text-muted-foreground">·</span>
          {flight.aircraft.tail_number}
          {flight.aircraft.model ? (
            <span className="text-muted-foreground"> · {flight.aircraft.model}</span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-start gap-3">
        {lock}
        <FlightStatusBadge status={flight.status} />
        <Link
          href={`/dispatch?flight=${flight.id}`}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-accent"
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
      <Stat value={`${fmtLbs(totals.crew_weight_lbs)} lb`} label="Crew Weight" />
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
        (emphasis ? "border-primary/40 bg-primary/5" : "border-border")
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
        Create the manifest to add passengers, mail and cargo. This page then
        shows the roster, the cargo list and the payload totals.
      </p>
      <CreateManifestButton flightId={flightId} />
    </div>
  );
}

function FlightStatusBadge({ status }: { status: FlightStatus }) {
  const map: Record<FlightStatus, [string, string]> = {
    scheduled: ["border-border bg-muted text-muted-foreground", "Scheduled"],
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
