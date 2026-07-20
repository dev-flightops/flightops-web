import Link from "next/link";

/**
 * /reservations/charter — Charter quote builder placeholder.
 *
 * Legacy has an itemized quote builder here (base rate + block time
 * + fuel + ferry + fees + discount). Landed as its own M3 follow-up
 * story once the reservations-service picks up a `charter_quote_lines`
 * table. For now we route dispatchers to the direct booking form,
 * which accepts a `quoted_total_cents` top-line as a placeholder.
 */
export default function CharterPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Charter</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quote builder for charter bookings.
        </p>
      </header>

      <section className="rounded-lg border border-status-yellow/40 bg-status-yellow/10 p-5 text-sm">
        <p className="font-semibold text-status-yellow">
          Charter quote builder — coming in an M3 follow-up.
        </p>
        <p className="mt-2 text-foreground/80">
          The itemized quote builder (base rate · block time · fuel ·
          ferry · fees · discount) lands with the{" "}
          <code className="rounded bg-muted/30 px-1 font-mono text-[0.85em]">
            charter_quote_lines
          </code>{" "}
          table in the next reservations-service PR. Until then, you can
          record a top-line quote on the direct booking form.
        </p>
        <p className="mt-3">
          <Link
            href="/reservations/bookings/new"
            className="rounded-md border border-status-blue bg-status-blue/15 px-3 py-1.5 text-xs font-semibold text-status-blue hover:bg-status-blue/20"
          >
            + File a Charter Booking
          </Link>
        </p>
      </section>
    </div>
  );
}
