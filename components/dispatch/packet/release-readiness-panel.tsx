import Link from "next/link";

import { linkCaps } from "@/components/ff/controls";
import { FratSignoffs } from "@/components/frat/frat-signoffs";
import type { FlightLoad } from "@/lib/api/manifest";
import type { FlightDetail, FratAssessmentResponse } from "@/lib/api/types";

function lb(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Math.round(Number(value)).toLocaleString("en-US")} lb`;
}

/**
 * What the release stands on, beside the release (#155). The client,
 * 10/29 (item 51): "The release page doesn't show the FRAT status or
 * weight and balance. The dispatcher can't see either before releasing."
 *
 * The FRAT: who filed it, its risk, the two sign-offs (the dispatcher
 * signs here), and what it still needs. The load: the one the release
 * judges, from the manifest or, without one, from the numbers typed on
 * the flight.
 */
export function ReleaseReadinessPanel({
  flight,
  frat,
  fratUnavailable,
  load,
  timeZone,
  canSignForDispatch,
}: {
  flight: FlightDetail;
  frat: FratAssessmentResponse | null;
  /** The FRAT couldn't be read: release still checks it. */
  fratUnavailable: boolean;
  load: FlightLoad | null;
  timeZone: string;
  canSignForDispatch: boolean;
}) {
  const release = load?.release ?? null;
  const remaining = release?.remaining_lbs === null || release === null ? null : Number(release.remaining_lbs);
  const over = remaining !== null && remaining < 0;
  const blockers = frat?.release_blockers ?? [];

  return (
    <section aria-label="Release readiness" className="space-y-3">
      <div className="rounded-lg border border-border bg-card">
        <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-3">
          <h2 className="section-title">FRAT</h2>
          <Link href={`/frat/${flight.id}`} className={linkCaps}>
            {frat ? "Open FRAT ›" : "File the FRAT ›"}
          </Link>
        </header>
        <div className="space-y-2 px-5 py-3 text-sm">
          {fratUnavailable ? (
            <p className="text-muted-foreground">The FRAT couldn't be read just now. Release still checks it.</p>
          ) : frat === null ? (
            <p className="text-foreground">
              No FRAT on this flight yet. The pilot files it from their schedule, or dispatch files it for
              the PIC. The flight can't be released until the pilot and a dispatcher have both signed it.
            </p>
          ) : (
            <>
              <p className="text-foreground">
                {`Risk ${frat.risk_level.toUpperCase()} · total ${frat.total_score}`}
                {frat.filed_by_name ? ` · filed by ${frat.filed_by_name}` : ""}
              </p>
              {blockers.length > 0 ? (
                <ul className="list-disc pl-5 text-status-yellow">
                  {blockers.map((b) => (
                    <li key={b.code}>
                      <span className="text-foreground">{b.message}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-status-green">Signed by both: the FRAT doesn&apos;t hold the release.</p>
              )}
            </>
          )}
        </div>
        {frat ? (
          <div className="px-5 pb-4">
            <FratSignoffs
              flightId={flight.id}
              frat={frat}
              timeZone={timeZone}
              canSign={{ pilot: false, dispatcher: canSignForDispatch }}
            />
          </div>
        ) : null}
      </div>

      <div className={`rounded-lg border bg-card ${over ? "border-status-red/50" : "border-border"}`}>
        <header className="border-b border-border px-5 py-3">
          <h2 className="section-title">Weight and balance</h2>
        </header>
        <div className="px-5 py-3 text-sm">
          {release === null ? (
            <p className="text-muted-foreground">The load couldn&apos;t be read just now. Release still checks it.</p>
          ) : release.useful_load_lbs === null ? (
            <p className="text-status-red">
              {`${flight.aircraft.tail_number} has no max payload on record, so the load can't be checked. Set it in Settings → Fleet.`}
            </p>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
                <div>
                  <dt className="field-label">Useful load</dt>
                  <dd className="tabular-nums">{lb(release.useful_load_lbs)}</dd>
                </div>
                <div>
                  <dt className="field-label">Crew and fuel</dt>
                  <dd className="tabular-nums">
                    {lb(release.useful_load_lbs - Number(release.payload_lbs) - (remaining ?? 0))}
                  </dd>
                </div>
                <div>
                  <dt className="field-label">Payload</dt>
                  <dd className="tabular-nums">{lb(release.payload_lbs)}</dd>
                </div>
                <div>
                  <dt className="field-label">{over ? "Over by" : "Left"}</dt>
                  <dd className={`tabular-nums font-semibold ${over ? "text-status-red" : "text-status-green"}`}>
                    {lb(remaining === null ? null : Math.abs(remaining))}
                  </dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-muted-foreground">
                {release.basis === "manifest"
                  ? "From the flight's manifest."
                  : "No manifest yet: from the passengers and cargo typed on the flight, passengers at 190 lb."}
                {over ? " The release refuses a load over the aircraft's useful load." : ""}
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
