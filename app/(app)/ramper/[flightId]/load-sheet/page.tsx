import Link from "next/link";
import { notFound } from "next/navigation";

import { loadZoneTable } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { getFlightManifest, MAIL_CLASS_LABELS, type ManifestDetailResponse } from "@/lib/api/manifest";
import { getFlight } from "@/lib/api/ops";
import { formatZulu } from "@/lib/format/flight-time";
import { DEFAULT_TIME_ZONE, localClock, localDate, zoneFor } from "@/lib/format/local-time";
import { loadSheet, type SheetGroup, type SheetLine, type SheetPassenger, type StopSheet } from "@/lib/ground/load-sheet";
import { flightStops, routeText } from "@/lib/route";

/**
 * /ramper/[flightId]/load-sheet: what to pull and what to load at each
 * stop (#208). The client, 20 Nov: "Rampers see when they are tagged to a
 * flight, but they don't know the manifest/weights to pull for each stop."
 *
 * Legacy's ramper flight page (templates/ramper/flight_detail.html) listed
 * the passengers ("170 lbs + 35 bag"), the cargo with a hazmat flag and the
 * mail, for a flight with one origin and one destination. Here each stop of
 * the route has its own: off here, then on here, with the pounds of bags,
 * mail and freight. Read-only: the manifest is dispatch's and the gate's.
 */

const fmt = (n: number) => `${Math.round(n).toLocaleString("en-US")} lb`;

function bagsText(p: SheetPassenger): string {
  const count = p.bagCount == null ? "" : `${p.bagCount} ${p.bagCount === 1 ? "bag" : "bags"}, `;
  const carry = p.carryOns ? ` · ${p.carryOns} carry-on` : "";
  if (!p.bagLbs && !p.bagCount) return `no checked bags${carry}`;
  return `${count}${fmt(p.bagLbs)}${carry}`;
}

function PassengerRow({ p }: { p: SheetPassenger }) {
  return (
    <li className="py-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium text-foreground">
          {p.name}
          {!p.checkedIn && <span className="ml-2 text-[0.68rem] text-muted-foreground">not checked in</span>}
        </span>
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          {`${fmt(p.weightLbs)} + ${bagsText(p)}`}
        </span>
      </div>
      {p.bags.length > 0 && (
        <ul className="mt-1 space-y-0.5 pl-3 text-xs text-muted-foreground">
          {p.bags.map((bag, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span>{bag.description || `Bag ${i + 1}`}</span>
              <span className="font-mono tabular-nums">{fmt(bag.weightLbs)}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function LineRow({ line }: { line: SheetLine }) {
  const label = line.mailClass ? MAIL_CLASS_LABELS[line.mailClass] : null;
  const name = label && line.description !== `USPS ${label}` ? `${label} · ${line.description}` : label ?? line.description;
  return (
    <li className="py-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium text-foreground">{name}</span>
        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
          {`${fmt(line.weightLbs)} · ${line.pieces} ${line.pieces === 1 ? "pc" : "pcs"}`}
        </span>
      </div>
      {line.consignee && <p className="text-xs text-muted-foreground">For {line.consignee}</p>}
      {line.isHazmat && (
        <p className="notice notice-yellow mt-1 text-xs font-semibold">
          {`HAZMAT${line.hazmatNotes ? `: ${line.hazmatNotes}` : ""} — handle with care`}
        </p>
      )}
      {line.notes && <p className="mt-0.5 text-xs text-muted-foreground">{line.notes}</p>}
    </li>
  );
}

function Group({ title, group, empty }: { title: string; group: SheetGroup; empty: string }) {
  const count = group.passengers.length + group.lines.length;
  return (
    <section aria-label={title} className="rounded-lg border border-border bg-card px-4 py-2">
      <div className="flex items-baseline justify-between gap-3 border-b border-border pb-1.5">
        <h3 className="eyebrow">{title}</h3>
        {count > 0 && (
          <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
            {`${fmt(group.lbs)} bags, mail and freight`}
          </span>
        )}
      </div>
      {count === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {group.passengers.map((p) => (
            <PassengerRow key={p.id} p={p} />
          ))}
          {group.lines.map((line) => (
            <LineRow key={line.id} line={line} />
          ))}
        </ul>
      )}
    </section>
  );
}

function stopTimes(stop: StopSheet, zone: string): string {
  const at = (label: string, iso: string | null) =>
    iso ? `${label} ${localClock(iso, zone)} (${formatZulu(iso)})` : null;
  return [at("lands", stop.arrives), at("departs", stop.departs)].filter(Boolean).join(" · ");
}

export default async function LoadSheetPage({ params }: { params: Promise<{ flightId: string }> }) {
  const { flightId } = await params;
  let flight;
  try {
    flight = await getFlight(flightId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  let manifest: ManifestDetailResponse | null = null;
  let manifestError: string | null = null;
  try {
    manifest = await getFlightManifest(flightId);
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 404)) {
      manifestError = "The manifest couldn't be read just now. Refresh to try again.";
    }
  }
  const zones = await loadZoneTable().catch(() => null);
  const stops = flightStops(flight);
  const sheet = loadSheet({ ...flight, stops }, manifest);
  const last = stops.length - 1;
  const lost = sheet.notOnRoute.passengers.length + sheet.notOnRoute.lines.length;

  return (
    <div className="mx-auto w-full max-w-[640px] px-4 pb-24 pt-3 sm:px-6">
      <Link
        href="/ramper"
        className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        <span aria-hidden>‹</span> Back to Ramp Worklist
      </Link>

      <header className="mb-4 rounded-lg border border-border bg-card p-4">
        <p className="eyebrow">Load sheet</p>
        <h1 className="page-title">{flight.flight_number}</h1>
        <p className="mt-0.5 text-sm font-semibold text-primary">
          {flight.aircraft?.tail_number ?? "—"}
          {flight.aircraft?.model ? ` · ${flight.aircraft.model}` : ""}
        </p>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          {`${routeText(flight)} · ${localDate(flight.scheduled_departure_at, zones ? zoneFor(zones, flight.origin) : DEFAULT_TIME_ZONE)}`}
        </p>
        <div className="mt-2 flex gap-4">
          <Link href={`/ramper/${flight.id}/photos`} className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-primary hover:underline">
            Photos <span aria-hidden>›</span>
          </Link>
        </div>
      </header>

      {manifestError && (
        <p role="alert" className="notice notice-yellow mb-4">
          {manifestError}
        </p>
      )}
      {!manifest && !manifestError && (
        <p className="notice notice-gray mb-4">No manifest for this flight yet: nothing to load or pull.</p>
      )}
      {lost > 0 && (
        <div role="alert" className="mb-4">
          <p className="notice notice-red mb-2">
            On the manifest for a stop this flight no longer makes. Check with dispatch before loading them.
          </p>
          <Group title="Not on the route" group={sheet.notOnRoute} empty="" />
        </div>
      )}

      {manifest && (
        <ol className="space-y-5">
          {sheet.stops.map((stop) => {
            const zone = zones ? zoneFor(zones, stop.icao) : DEFAULT_TIME_ZONE;
            return (
              <li key={stop.index} aria-label={`Stop ${stop.index + 1}, ${stop.icao}`}>
                <h2 className="mb-2 flex flex-wrap items-baseline gap-x-2 px-1">
                  <span className="font-mono text-sm font-bold text-foreground">{`${stop.index + 1} · ${stop.icao}`}</span>
                  <span className="text-xs text-muted-foreground">{stopTimes(stop, zone)}</span>
                </h2>
                <div className="space-y-2">
                  {stop.index > 0 && <Group title="Off here" group={stop.off} empty="Nothing comes off here." />}
                  {stop.index < last && <Group title="On here" group={stop.on} empty="Nothing goes on here." />}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
