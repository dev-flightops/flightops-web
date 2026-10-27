import Link from "next/link";

import { linkCaps } from "@/components/ff/controls";
import { cn } from "@/lib/utils";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { ApiError } from "@/lib/api/client";
import { getFlight } from "@/lib/api/ops";
import {
  getFlightManifest,
  getLoadPlan,
  MAIL_CLASS_LABELS,
  mailDescription,
  type LegSeats,
  type LoadPlanResponse,
  type ManifestDetailResponse,
} from "@/lib/api/manifest";
import { fuelEstimateLine } from "@/lib/flights/fuel-estimate";
import type { FlightDetail, FlightStatus } from "@/lib/api/types";
import { hasAnyRole, MANIFEST_EDITORS, MANIFEST_LOCKERS } from "@/lib/roles";
import { flightStops } from "@/lib/route";

import { PlannedFuelForm } from "./fuel-form";
import { LoadPlanApply } from "./load-plan-apply";
import { FreightSection } from "./freight-section";
import { CreateManifestButton, LockManifestButton } from "./manifest-controls";
import { fmtLbs, TH, THEAD } from "./manifest-bits";
import { PassengersSection } from "./pax-section";

export const dynamic = "force-dynamic";

/**
 * /manifest/[flightId] — passenger + cargo manifest for a single flight.
 *
 * Reached from the /manifest schedule board. Renders three blocks:
 *   1. Flight headline (flight #, route, aircraft, status)
 *   2. Totals strip (pax counts and weights) and the load left for mail
 *      and freight: useful load − crew − planned fuel − payload (#74)
 *   3. Pax table + Cargo table
 *
 * When the flight has no manifest yet the endpoint returns 404 — we
 * show a helpful empty state rather than redirecting; the dispatcher
 * decides when to create one.
 *
 * Entry (#62): while the manifest is a draft anyone on staff adds, edits
 * and removes passengers, mail and cargo, as legacy's manifest page lets
 * them, except the accountant, who reads it as legacy's bookkeeper did
 * (MANIFEST_EDITORS, #128). Locking it is final and is the check-in roles'
 * (MANIFEST_LOCKERS), legacy's close-boarding roles.
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

  // The load plan (#75). An ops build from before it answers 404 or an
  // error; the page then simply goes without the section.
  let plan: LoadPlanResponse | null = null;
  if (manifest) {
    try {
      plan = await getLoadPlan(flightId);
    } catch {
      plan = null;
    }
  }

  const roles = (await auth())?.roles ?? [];
  const canBuild = hasAnyRole(roles, MANIFEST_EDITORS);
  const editable = manifest?.status === "draft" && canBuild;
  const canLock = editable && hasAnyRole(roles, MANIFEST_LOCKERS);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <div className="mb-4 text-xs">
        <Link
          href="/manifest"
          className={cn(linkCaps, "text-muted-foreground hover:text-foreground")}
        >
          <span aria-hidden>‹</span> Flight Schedule
        </Link>
      </div>

      <FlightHeader
        flight={flight}
        lock={canLock ? <LockManifestButton flightId={flight.id} flightNumber={flight.flight_number} /> : null}
      />

      {manifest ? (
        <>
          {manifest.status === "final" ? <LockedBanner manifest={manifest} /> : null}

          <TotalsStrip totals={manifest.totals} />

          <LoadPanel manifest={manifest} editable={editable} />

          {manifest.legs && manifest.legs.length > 1 ? <LegSeatsPanel legs={manifest.legs} /> : null}

          {plan ? <LoadPlanSection plan={plan} flight={flight} editable={editable} /> : null}

          <div className="mt-6 grid gap-6">
            <PassengersSection
              flightId={flight.id}
              rows={manifest.pax}
              editable={editable}
              stops={flightStops(flight)}
            />
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
        <EmptyState flightId={flight.id} canCreate={canBuild} />
      )}
    </div>
  );
}

/**
 * Seats leg by leg on a flight with stops (#120): passengers picked up at
 * one stop and dropped at another share the aircraft's seats per leg, so
 * the flight can carry more people in all than it has seats.
 */
function LegSeatsPanel({ legs }: { legs: LegSeats[] }) {
  return (
    <section aria-label="Seats by leg" className="mb-6 overflow-hidden rounded-lg border border-border bg-card">
      <h2 className="border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Seats by leg
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className={THEAD}>
            <tr>
              <th className={TH}>Leg</th>
              <th className={`${TH} text-right`}>Aboard</th>
              <th className={`${TH} text-right`}>Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {legs.map((leg, i) => (
              <tr key={`${i}-${leg.origin}-${leg.destination}`}>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                  {`${i + 1}  ${leg.origin} → ${leg.destination}`}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">{leg.held}</td>
                <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">{leg.open ?? "?"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LockedBanner({ manifest }: { manifest: ManifestDetailResponse }) {
  return (
    <div
      role="status"
      className="mb-6 notice notice-green text-sm"
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
    <header className="mb-6 flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="eyebrow mb-1">Passenger Manifest</p>
        <h1 className="page-title">
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
          href={`/check-in/${flight.id}`}
          className="btn-caps rounded-md border border-input px-3 py-1.5 text-foreground hover:bg-accent text-[0.72rem]"
        >
          Gate Check-in →
        </Link>
        <Link
          href={`/dispatch?flight=${flight.id}`}
          className="btn-caps rounded-md border border-input px-3 py-1.5 text-foreground hover:bg-accent text-[0.72rem]"
        >
          Open Dispatch Packet →
        </Link>
      </div>
    </header>
  );
}

function TotalsStrip({ totals }: { totals: ManifestDetailResponse["totals"] }) {
  return (
    <div className="mb-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 lg:grid-cols-6">
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
    </div>
  );
}

const CREW_BASIS: Record<ManifestDetailResponse["load"]["crew_basis"], (count: number) => string> = {
  manifest: () => "as weighed on the manifest",
  standard: (count) => `${count} assigned, at standard weight`,
  none: () => "none on the flight yet",
};

/**
 * What is left of the aircraft's useful load for mail and freight (#74):
 * useful load − crew − planned fuel − payload, worked out by ops. The old
 * headroom was useful load − payload, which left crew and fuel out and
 * overstated the room for mail by their weight. Until the planned fuel is
 * entered the figure is labelled as before fuel, never passed off as real.
 */
function LoadPanel({ manifest, editable }: { manifest: ManifestDetailResponse; editable: boolean }) {
  const load = manifest.load;
  // An ops build from before #74 sends no breakdown; show nothing rather
  // than fail the page while the two deploys catch up with each other.
  if (!load) return null;
  if (load.useful_load_lbs == null) {
    return (
      <section aria-label="Load" className="mb-6 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        {`Set this aircraft’s useful load in Settings → Aircraft to see the weight left for mail and freight.`}
      </section>
    );
  }
  const remaining = Number(load.remaining_lbs);
  const over = remaining < 0;
  const tone = over
    ? "text-status-red"
    : !load.fuel_counted || remaining < 200
      ? "text-status-yellow"
      : "text-status-green";
  const result = over
    ? "Over the useful load by"
    : load.fuel_counted
      ? "Left for mail & freight"
      : "Left before fuel";
  return (
    <section aria-label="Load" className="mb-6 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
        <Term label="Useful load" value={`${load.useful_load_lbs.toLocaleString()} lb`} />
        <Op>−</Op>
        <Term label="Crew" value={`${fmtLbs(load.crew_lbs)} lb`} note={CREW_BASIS[load.crew_basis](load.crew_count)} />
        <Op>−</Op>
        <Term
          label="Fuel"
          value={load.fuel_lbs != null ? `${fmtLbs(load.fuel_lbs)} lb` : "not entered"}
          note={load.fuel_lbs == null ? undefined : load.fuel_basis === "estimated" ? "estimated" : "planned"}
        />
        <Op>−</Op>
        <Term label="Payload" value={`${fmtLbs(load.payload_lbs)} lb`} note="passengers, bags, cargo, mail" />
        <Op>=</Op>
        <Term label={result} value={`${fmtLbs(Math.abs(remaining))} lb`} valueClass={tone} emphasis />
      </div>
      {load.fuel_basis === "estimated" && load.fuel_estimate ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {`${fuelEstimateLine(load.fuel_estimate)} Enter the planned fuel to use your own figure instead.`}
        </p>
      ) : null}
      {!load.fuel_counted ? (
        <p className="mt-3 text-xs text-status-yellow">
          {load.fuel_estimate?.missing.length
            ? `Fuel isn’t counted yet. Enter the planned fuel, or set ${load.fuel_estimate.missing.join(" and ")} to have it estimated.`
            : `Fuel isn’t counted yet. Enter the planned fuel to see what is really left for mail and freight.`}
        </p>
      ) : null}
      {editable ? (
        <div className="mt-3 border-t border-border pt-3">
          <PlannedFuelForm flightId={manifest.flight_id} current={manifest.planned_fuel_lbs} />
        </div>
      ) : null}
    </section>
  );
}

const BLOCKED: Record<NonNullable<LoadPlanResponse["blocked"]>, string> = {
  locked: "The manifest is locked, so nothing more goes on.",
  no_useful_load: "Set the aircraft’s useful load in Settings → Aircraft to plan the load.",
  fuel_unknown: "Enter the planned fuel above, or set up the fuel estimate, before filling the weight left.",
  nothing_waiting: "Nothing is waiting for this route.",
  no_room: "There is no weight left for mail or freight.",
};

/** Why nothing is suggested: with some weight left, that nothing fits it. */
function blockedMessage(plan: LoadPlanResponse): string | null {
  if (!plan.blocked) return null;
  const left = Number(plan.load.remaining_lbs ?? 0);
  if (plan.blocked === "no_room" && left > 0) {
    return `Nothing waiting fits in the ${fmtLbs(plan.load.remaining_lbs ?? "0")} lb left.`;
  }
  return BLOCKED[plan.blocked];
}

/**
 * Mail and freight waiting for this flight's route, and what to put on it
 * (#75). Ops works out the suggestion: the weight left after crew, fuel and
 * passengers, filled with USPS priority classes first, then bypass, then
 * cargo, oldest first, in whole pieces. One click loads it; what doesn't
 * fit stays waiting.
 */
function LoadPlanSection({
  plan,
  flight,
  editable,
}: {
  plan: LoadPlanResponse;
  flight: FlightDetail;
  editable: boolean;
}) {
  const route = `${plan.origin} for ${plan.destinations.join(", ")}`;
  const waitingLbs = plan.waiting.reduce((sum, w) => sum + Number(w.weight_lbs), 0);
  const blocked = blockedMessage(plan);
  return (
    <section aria-label="Mail and freight waiting" className="mb-6 rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {`Waiting at ${route}`}
        </h2>
        <Link
          href={`/manifest/waiting?station=${encodeURIComponent(plan.origin)}`}
          className="text-xs text-primary hover:underline"
        >
          All waiting mail &amp; freight →
        </Link>
      </div>
      {plan.waiting.length === 0 ? (
        <p className="text-sm text-muted-foreground">{`Nothing is waiting at ${route}.`}</p>
      ) : (
        <>
          <p className="mb-3 text-sm">
            {`${plan.waiting.length} ${plan.waiting.length === 1 ? "entry" : "entries"} waiting, ${fmtLbs(waitingLbs)} lb.`}
          </p>
          {plan.suggestion.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
                  <tr>
                    <th scope="col" className="py-2 pr-3 font-semibold">Suggested</th>
                    <th scope="col" className="py-2 pr-3 text-right font-semibold">Weight</th>
                    <th scope="col" className="py-2 text-right font-semibold">Pieces</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {plan.suggestion.map((t) => (
                    <tr key={t.waiting_load_id}>
                      <td className="py-2 pr-3">
                        {t.description}
                        {t.mail_class && t.description !== mailDescription(t.mail_class) ? (
                          <span className="ml-2 text-xs text-muted-foreground">{MAIL_CLASS_LABELS[t.mail_class]}</span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {t.weight_lbs === t.of_weight_lbs
                          ? `${fmtLbs(t.weight_lbs)} lb`
                          : `${fmtLbs(t.weight_lbs)} of ${fmtLbs(t.of_weight_lbs)} lb`}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {t.pieces === t.of_pieces ? `${t.pieces}` : `${t.pieces} of ${t.of_pieces}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-muted-foreground">
                {`Suggested ${fmtLbs(plan.suggested_lbs)} lb · ${fmtLbs(plan.left_after_lbs ?? 0)} lb left after. What doesn’t fit stays waiting for the next flight.`}
              </p>
            </div>
          ) : blocked ? (
            <p className="text-sm text-status-yellow">{blocked}</p>
          ) : null}
        </>
      )}
      {/* Outside the branches above, so it stays mounted when a load
          empties the suggestion and its "Loaded …" message survives. */}
      {editable ? (
        <LoadPlanApply
          flightId={flight.id}
          flightNumber={flight.flight_number}
          items={plan.suggestion.map((t) => ({
            waiting_load_id: t.waiting_load_id,
            weight_lbs: t.weight_lbs,
            pieces: t.pieces,
          }))}
          totalLbs={plan.suggested_lbs}
        />
      ) : null}
    </section>
  );
}

function Op({ children }: { children: string }) {
  return (
    <span aria-hidden className="pb-1 text-lg text-muted-foreground">
      {children}
    </span>
  );
}

function Term({
  label,
  value,
  note,
  valueClass = "",
  emphasis = false,
}: {
  label: string;
  value: string;
  note?: string;
  valueClass?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="eyebrow">{label}</span>
      <span className={`tabular-nums ${emphasis ? "font-display text-xl font-extrabold" : "text-base font-semibold"} ${valueClass}`}>
        {value}
      </span>
      {note ? <span className="text-[0.6875rem] text-muted-foreground">{note}</span> : null}
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
        "flex min-w-0 flex-col border-l-2 py-1 pl-3 " +
        (emphasis ? "border-primary" : "border-input")
      }
    >
      <div
        className={
          "font-display text-xl font-extrabold leading-none tabular-nums " + (valueClass || "text-foreground")
        }
      >
        {value}
      </div>
      <div className="eyebrow mt-1.5">
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

function EmptyState({ flightId, canCreate }: { flightId: string; canCreate: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card py-16 text-center">
      <p className="mb-2 text-sm font-medium text-foreground">
        No manifest created for this flight yet.
      </p>
      {canCreate ? (
        <>
          <p className="mx-auto mb-5 max-w-md text-xs text-muted-foreground">
            Create the manifest to add passengers, mail and cargo. This page then
            shows the roster, the cargo list and the payload totals.
          </p>
          <CreateManifestButton flightId={flightId} />
        </>
      ) : null}
    </div>
  );
}

function FlightStatusBadge({ status }: { status: FlightStatus }) {
  const map: Record<FlightStatus, [string, string]> = {
    scheduled: ["text-muted-foreground", "Scheduled"],
    released: [
      "text-status-blue",
      "Released",
    ],
    completed: [
      "text-status-green",
      "Completed",
    ],
    cancelled: [
      "text-status-yellow",
      "Cancelled",
    ],
  };
  const [cls, label] = map[status];
  return (
    <span
      className={
        "status-mark text-xs " +
        cls
      }
    >
      {label}
    </span>
  );
}
