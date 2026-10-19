import Link from "next/link";

import { loadZoneTable } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { listWaiting, MAIL_CLASS_LABELS, type WaitingListResponse } from "@/lib/api/manifest";
import { zoneAbbreviation, zoneFor, type ZoneTable } from "@/lib/format/local-time";

import { fmtLbs, THEAD, TH } from "../[flightId]/manifest-bits";
import { AddWaitingForm, CancelWaitingButton } from "./waiting-forms";

export const dynamic = "force-dynamic";

/**
 * /manifest/waiting — mail and freight on hand at each station, before it
 * is on any flight (#75).
 *
 * Ground logs it here; each flight's manifest then shows what is waiting
 * for its route and suggests filling its spare weight from it. An entry's
 * weight and pieces are what is still on the ground: loading part of it
 * leaves the rest here, and taking a line off a manifest puts it back.
 */
export default async function WaitingMailFreightPage({
  searchParams,
}: {
  searchParams: Promise<{ station?: string }>;
}) {
  const { station: rawStation } = await searchParams;
  const station = rawStation && /^[A-Za-z0-9]{3,4}$/.test(rawStation) ? rawStation.toUpperCase() : undefined;

  // Received times read in the station's own zone (#68).
  const zones = loadZoneTable();
  let data: WaitingListResponse | null = null;
  let loadError: string | null = null;
  try {
    data = await listWaiting({ station });
  } catch (err) {
    loadError =
      err instanceof ApiError && err.status === 401
        ? "Your session expired. Sign in again."
        : "The waiting list is unavailable. Try refreshing in a moment.";
  }

  const table: ZoneTable = await zones;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <div className="mb-4 text-xs">
        <Link href="/manifest" className="text-muted-foreground hover:text-foreground">
          ← Flight Schedule
        </Link>
      </div>
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Mail &amp; Freight Waiting</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {`What ground has on hand at each station before it is on a flight. Each flight’s manifest shows what is waiting for its route and suggests filling the weight left with it.`}
        </p>
        {station ? (
          <p className="mt-2 text-xs">
            {`At ${station} only · `}
            <Link href="/manifest/waiting" className="text-primary hover:underline">
              show every station
            </Link>
          </p>
        ) : null}
      </header>

      <section aria-label="Log mail or freight" className="mb-6 rounded-lg border border-border bg-card p-4">
        <AddWaitingForm station={station} />
      </section>

      {loadError ? (
        <p role="alert" className="text-sm text-status-yellow">
          {loadError}
        </p>
      ) : data && data.routes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing is waiting.</p>
      ) : (
        (data?.routes ?? []).map((route) => {
          const zone = zoneFor(table, route.station_icao);
          const items = (data?.items ?? []).filter(
            (i) => i.station_icao === route.station_icao && i.destination_icao === route.destination_icao,
          );
          const title = `${route.station_icao} → ${route.destination_icao}`;
          return (
            <section key={title} aria-label={title} className="mb-6 overflow-hidden rounded-lg border border-border bg-card">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3">
                <h2 className="text-base font-semibold">{title}</h2>
                <p className="text-sm tabular-nums text-muted-foreground">
                  {`${route.entries} ${route.entries === 1 ? "entry" : "entries"} · ${fmtLbs(route.weight_lbs)} lb · ${route.pieces} pieces`}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className={THEAD}>
                    <tr>
                      <th scope="col" className={TH}>Received</th>
                      <th scope="col" className={TH}>What</th>
                      <th scope="col" className={`${TH} text-right`}>Weight</th>
                      <th scope="col" className={`${TH} text-right`}>Pieces</th>
                      <th scope="col" className={TH}>Shipper → Consignee</th>
                      <th scope="col" className={TH}>Notes</th>
                      <th scope="col" className={`${TH} text-right`}>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items.map((i) => (
                      <tr key={i.id}>
                        <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                          {received(i.received_at, zone)}
                        </td>
                        <td className="px-3 py-2.5">
                          {i.description}
                          {i.mail_class ? (
                            <span className="ml-2 text-xs text-muted-foreground">{MAIL_CLASS_LABELS[i.mail_class]}</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{`${fmtLbs(i.weight_lbs)} lb`}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{i.pieces}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">
                          {i.shipper || i.consignee ? `${i.shipper ?? "—"} → ${i.consignee ?? "—"}` : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{i.notes ?? "—"}</td>
                        <td className="px-3 py-2.5 text-right">
                          <CancelWaitingButton id={i.id} label={i.description} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

/** "Oct 20, 08:00 AKDT": when ground took it in, at the station. */
function received(iso: string, timeZone: string): string {
  const at = new Date(iso);
  const clock = at.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  });
  return `${clock} ${zoneAbbreviation(timeZone, at)}`;
}
