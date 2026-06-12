import { notFound } from "next/navigation";

import { ApiError } from "@/lib/api/client";
import { listMyTenants } from "@/lib/api/auth";
import { getFlight } from "@/lib/api/ops";
import type { FlightDetail } from "@/lib/api/types";

import { PrintButton } from "./print-button";

/**
 * /schedule/{flightId}/manifest — Printable Part 135 release sheet.
 *
 * Rendered with a print stylesheet (in this file) so the dispatcher
 * can hit Cmd/Ctrl-P and get a letter-size document.
 *
 * What's on it:
 *   - Header block: company name, FAR Part 135 label, date, flight #,
 *     tail, route
 *   - Aircraft block: tail, type, seats, max payload
 *   - Crew block: PIC + cert (placeholder until crew-service ships)
 *   - Load summary: passenger count vs seats, cargo weight
 *   - Times: scheduled + actual departure/arrival, last released_at
 *   - Signature lines for dispatcher + PIC
 *
 * Full passenger manifest with names + weights + seat assignments
 * needs a pax-manifest table that doesn't exist yet (M3). For now the
 * release sheet captures the data the FAA actually requires for Part
 * 135 dispatch — the aircraft, the crew, the gross loadings, and the
 * dispatch signature.
 */
export default async function ManifestPage({
  params,
}: {
  params: Promise<{ flightId: string }>;
}) {
  const { flightId } = await params;

  let flight: FlightDetail | null = null;
  let companyName = "Peregrine Flight Ops";

  try {
    const [f, tenants] = await Promise.all([
      getFlight(flightId),
      listMyTenants().catch(() => ({ tenants: [] })),
    ]);
    flight = f;
    companyName =
      tenants.tenants.find((t) => t.is_current)?.name ??
      tenants.tenants[0]?.name ??
      companyName;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <p
          role="alert"
          className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          Manifest unavailable — try refreshing in a moment.
        </p>
      </div>
    );
  }
  if (flight === null) notFound();

  const releasedAtStamp = flight.released_at
    ? formatUtcStamp(flight.released_at)
    : null;
  const releasedAtLabel = releasedAtStamp
    ? `${releasedAtStamp.date} ${releasedAtStamp.time}Z`
    : "— not released —";
  const scheduledDep = formatUtcStamp(flight.scheduled_departure_at);
  const scheduledArr = formatUtcStamp(flight.scheduled_arrival_at);
  const atd = flight.actual_departure_at
    ? formatUtcStamp(flight.actual_departure_at)
    : null;
  const ata = flight.actual_arrival_at
    ? formatUtcStamp(flight.actual_arrival_at)
    : null;
  const seatsLine =
    flight.aircraft.seats > 0
      ? `${flight.pax_count} of ${flight.aircraft.seats}`
      : `${flight.pax_count}`;
  const payloadHeadroom =
    flight.max_payload_lbs !== null
      ? Math.max(
          0,
          flight.max_payload_lbs - flight.pax_count * 190 - flight.cargo_lbs,
        )
      : null;

  return (
    <div className="manifest-page mx-auto max-w-[800px] px-6 py-8 text-foreground print:max-w-none print:px-0 print:py-0">
      <PrintButton />
      <ManifestStyles />

      <header className="mb-6 border-b-2 border-foreground pb-4">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-bold uppercase tracking-[0.06em]">
            {companyName}
          </h1>
          <span className="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">
            FAR Part 135 — Dispatch Release
          </span>
        </div>
        <p className="mt-2 text-xs uppercase tracking-[0.06em] text-muted-foreground">
          Released {releasedAtLabel}
        </p>
      </header>

      <section className="mb-5 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
        <Field label="Flight #" value={flight.flight_number} mono />
        <Field
          label="Route"
          value={`${flight.origin} → ${flight.destination}`}
          mono
        />
        <Field label="Date (UTC)" value={scheduledDep.date} mono />
        <Field label="Status" value={flight.status.toUpperCase()} />
      </section>

      <Section title="Aircraft">
        <Field label="Tail" value={flight.aircraft.tail_number} mono />
        <Field label="Type" value={flight.aircraft.model} />
        <Field label="Seats" value={String(flight.aircraft.seats)} />
        <Field
          label="Max Payload"
          value={
            flight.max_payload_lbs !== null
              ? `${flight.max_payload_lbs.toLocaleString()} lbs`
              : "—"
          }
        />
      </Section>

      <Section title="Crew">
        <Field label="PIC" value="— from crew-service (M3) —" />
        <Field label="Cert" value="—" />
        <Field label="SIC" value="—" />
      </Section>

      <Section title="Load">
        <Field label="Passengers" value={seatsLine} />
        <Field
          label="Cargo"
          value={`${flight.cargo_lbs.toLocaleString()} lbs`}
        />
        <Field
          label="Payload Head-Room"
          value={
            payloadHeadroom !== null
              ? `${payloadHeadroom.toLocaleString()} lbs`
              : "—"
          }
        />
        <Field
          label="Pax Weight (est. 190 lb)"
          value={`${(flight.pax_count * 190).toLocaleString()} lbs`}
        />
      </Section>

      <Section title="Times (UTC)">
        <Field
          label="Scheduled Departure"
          value={`${scheduledDep.date} ${scheduledDep.time}`}
          mono
        />
        <Field
          label="Scheduled Arrival"
          value={`${scheduledArr.date} ${scheduledArr.time}`}
          mono
        />
        <Field
          label="Actual Departure"
          value={atd ? `${atd.date} ${atd.time}` : "—"}
          mono
        />
        <Field
          label="Actual Arrival"
          value={ata ? `${ata.date} ${ata.time}` : "—"}
          mono
        />
      </Section>

      {flight.notes && (
        <Section title="Dispatcher Notes">
          <p className="col-span-2 whitespace-pre-wrap text-sm">
            {flight.notes}
          </p>
        </Section>
      )}

      <section className="mt-8 grid grid-cols-2 gap-x-12 text-xs">
        <SignatureLine label="Dispatcher" />
        <SignatureLine label="Pilot in Command" />
      </section>

      <footer className="mt-8 text-[0.65rem] uppercase tracking-[0.08em] text-muted-foreground print:fixed print:bottom-4 print:left-6 print:right-6">
        <p>
          Flight ID {flight.id} · Document generated {formatUtcStamp(new Date().toISOString()).date} {formatUtcStamp(new Date().toISOString()).time}Z
        </p>
      </footer>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      <h2 className="mb-2 border-b border-foreground/30 pb-1 text-[0.7rem] font-bold uppercase tracking-[0.1em]">
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
        {children}
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </dt>
      <dd className={`m-0 mt-0.5 ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

function SignatureLine({ label }: { label: string }) {
  return (
    <div>
      <div className="mt-6 border-t border-foreground" />
      <p className="mt-1 text-[0.6rem] uppercase tracking-[0.08em] text-muted-foreground">
        {label} · Signature & Date
      </p>
    </div>
  );
}

interface UtcStamp {
  date: string;
  time: string;
}

function formatUtcStamp(iso: string): UtcStamp {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
  };
}

function ManifestStyles() {
  return (
    <style>{`
      @media print {
        .no-print { display: none !important; }
        body { background: #fff !important; color: #000 !important; }
        .manifest-page { color: #000; }
        .manifest-page h1, .manifest-page h2 { color: #000; }
        @page { size: letter; margin: 0.5in; }
      }
    `}</style>
  );
}
