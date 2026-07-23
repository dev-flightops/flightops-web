import Link from "next/link";

/**
 * /maintenance/rts — legacy `templates/maintenance/rts_queue.html`.
 *
 * Three-section RTS workflow (empty-state until Marc's M2 backend lands):
 *   1. RII — Awaiting Inspector Signoff (yellow header) — RII inspector
 *      form with cert number + confirm checkbox, plus Reject / Defer
 *      accordions
 *   2. Pending RTS — Awaiting Signoff (blue header) — AMT airworthy
 *      form (name + cert # + cert type + work notes + certify checkbox),
 *      plus Reject / Defer accordions
 *   3. Open Squawks on Held Aircraft (red header) — deep-link back to
 *      the aircraft detail
 *   Plus an "Aircraft Currently on RTS Hold" table.
 *
 * Renders the shell for all four sections with legacy headings so the
 * layout is intact; each section shows an empty-state row today. Swap
 * to real data (pending_rii, pending_non_rii, open_on_hold,
 * held_aircraft from `GET /maintenance/rts/queue`) once the endpoint
 * lands.
 */
export default function RtsQueuePage() {
  const canSignoff = false;
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Return to Service Queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Aircraft pending AMT signoff or RII inspector review
          </p>
        </div>
        <Link
          href="/maintenance"
          className="rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted/30"
        >
          ← Maintenance
        </Link>
      </header>

      {!canSignoff && (
        <div className="mb-5 rounded-lg border border-status-blue/40 bg-status-blue/10 px-4 py-2.5 text-sm text-status-blue">
          View only — AMT, DOM, or admin role required to perform signoffs.
        </div>
      )}

      <SectionHeader color="yellow" label="RII — Awaiting Inspector Signoff" count={0} />
      <EmptySection text="No RII items awaiting inspector signoff." />

      <SectionHeader color="blue" label="Pending RTS — Awaiting Signoff" count={0} />
      <EmptySection text="No aircraft pending RTS signoff. Squawks appear here once maintenance completes airworthiness work." />

      <SectionHeader color="red" label="Open Squawks on Held Aircraft" count={0} />
      <EmptySection text="No open squawks on held aircraft. Squawks that reject through RTS return here." />

      <SectionHeader color="gray" label="Aircraft Currently on RTS Hold" count={0} />
      <div className="mb-6 overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/10 text-left text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2 font-semibold">N-Number</th>
                <th scope="col" className="px-4 py-2 font-semibold">Type</th>
                <th scope="col" className="px-4 py-2 font-semibold">Base</th>
                <th scope="col" className="px-4 py-2 font-semibold">Status</th>
                <th scope="col" className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No aircraft currently on RTS hold.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card px-4 py-16 text-center">
        <p className="mb-2 text-lg font-semibold text-status-green">No pending RTS items</p>
        <p className="text-sm text-muted-foreground">
          All aircraft are cleared. No squawks awaiting signoff.
        </p>
      </div>
    </div>
  );
}

function SectionHeader({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: "yellow" | "blue" | "red" | "gray";
}) {
  const cls = {
    yellow: "text-status-yellow",
    blue: "text-status-blue",
    red: "text-status-red",
    gray: "text-muted-foreground",
  }[color];
  return (
    <h2 className={"mb-3 mt-2 text-sm font-bold uppercase tracking-[0.08em] " + cls}>
      {label} ({count})
    </h2>
  );
}

function EmptySection({ text }: { text: string }) {
  return (
    <div className="mb-8 rounded-lg border border-border bg-card px-4 py-8 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
