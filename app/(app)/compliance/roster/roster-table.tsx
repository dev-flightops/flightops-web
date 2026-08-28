import Link from "next/link";

import type {
  CurrencyItemRef,
  FlightTimeWindow,
  PilotRosterGroup,
  PilotRosterRow,
} from "@/lib/api/types";

import { STATUS_TOKENS } from "../crew-currency/status-tokens";

/**
 * Presentational half of the FAR 135 pilot roster.
 *
 * Split from page.tsx so it can be rendered in a test — page.tsx calls
 * getPilotRoster(), which reaches lib/api/* -> apiFetch -> next-auth ->
 * next/server, and next/server does not resolve under vitest. Importing
 * only the TYPE here keeps that chain out of the test environment. Fifth
 * time this pattern has been needed in this repo.
 *
 * LAYOUT
 *
 * Mirrors the legacy /crew/roster: crew rows grouped by base, currency
 * columns, then the flight-time totals. Legacy's columns were Name /
 * Role / Cert / Medical / Flt Review / IFR / Recurrent / Aircraft /
 * 24h / 7d / Mo. Certificate and aircraft qualification are not stored
 * yet — see the 135.63 recordkeeping gaps — so those two columns are
 * absent rather than rendered empty. A column of dashes reads as "we
 * checked and there is nothing", which is not what is true.
 *
 * The currency columns come from the same records the compliance board
 * renders, so the two pages cannot disagree.
 */

const WINDOW_HEADS: Array<{ key: FlightTimeWindow["window"]; head: string }> = [
  { key: "h24", head: "24h" },
  { key: "d7", head: "7d" },
  { key: "month", head: "Mo" },
  { key: "year", head: "Yr" },
];

export function RosterTable({
  items,
  groups,
}: {
  items: CurrencyItemRef[];
  groups: PilotRosterGroup[];
}) {
  const total = groups.reduce((n, g) => n + g.rows.length, 0);

  if (total === 0) {
    return (
      <p className="rounded-lg border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
        No active pilots on the roster.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.label}>
          <h2 className="mb-2 flex items-baseline gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {group.label}
            <span className="font-normal normal-case tracking-normal">
              {group.rows.length} pilot{group.rows.length === 1 ? "" : "s"}
            </span>
          </h2>

          {/* Wide table: the currency columns grow with the operator's
              item catalogue, so this scrolls inside its own container
              rather than pushing the page sideways. */}
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border">
                  <Th className="text-left">Name</Th>
                  <Th className="text-left">Role</Th>
                  {items.map((item) => (
                    <Th key={item.id} title={item.name}>
                      {abbreviate(item)}
                    </Th>
                  ))}
                  {WINDOW_HEADS.map((w) => (
                    <Th key={w.key} className="tabular-nums">
                      {w.head}
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => (
                  <Row key={row.pilot.id} row={row} items={items} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

function Row({
  row,
  items,
}: {
  row: PilotRosterRow;
  items: CurrencyItemRef[];
}) {
  const byItem = new Map(row.cells.map((c) => [c.currency_item_id, c]));
  const windows = new Map(row.flight_time.map((w) => [w.window, w]));

  return (
    <tr
      className={
        "border-b border-border/60 last:border-0 " +
        // A flight-time breach tints the whole row. It is not a currency
        // status and does not belong in the status columns, but a chief
        // pilot scanning the page needs to see it without reading across.
        (row.flight_time_exceeded ? "bg-status-red/[0.06]" : "")
      }
    >
      <td className="whitespace-nowrap px-3 py-2">
        <Link
          href={`/compliance/pilots/${row.pilot.id}`}
          className="font-medium text-foreground hover:underline"
        >
          {row.pilot.full_name}
        </Link>
        {row.emp_number ? (
          <span className="ml-2 font-mono text-[0.65rem] text-muted-foreground">
            {row.emp_number}
          </span>
        ) : null}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
        {row.title ?? "—"}
      </td>

      {items.map((item) => {
        const cell = byItem.get(item.id);
        if (!cell) return <Td key={item.id}>—</Td>;
        const token = STATUS_TOKENS[cell.status];
        return (
          <Td key={item.id}>
            <span className={token.pill} title={token.label}>
              {token.label}
            </span>
          </Td>
        );
      })}

      {WINDOW_HEADS.map(({ key }) => {
        const w = windows.get(key);
        if (!w) return <Td key={key}>—</Td>;
        return (
          <Td key={key} className="tabular-nums">
            <span
              className={
                "font-mono text-xs " +
                (w.exceeded
                  ? "font-bold text-status-red"
                  : w.approaching
                    ? "font-semibold text-status-yellow"
                    : "text-muted-foreground")
              }
              // The citation is the useful tooltip: a chief pilot asked
              // "why is this red" wants the paragraph, not the number.
              title={`${w.hours} of ${w.limit} h — ${w.label} (${w.citation})`}
            >
              {w.hours}
            </span>
          </Td>
        );
      })}
    </tr>
  );
}

function Th({
  children,
  className = "",
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <th
      scope="col"
      title={title}
      className={
        "whitespace-nowrap px-3 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground " +
        (className || "text-center")
      }
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-3 py-2 text-center ${className}`}>{children}</td>
  );
}

/** Column heads have to fit a matrix that grows with the operator's
 *  catalogue, so long names are trimmed. The full name stays on the
 *  header's title attribute. */
function abbreviate(item: CurrencyItemRef): string {
  return ABBREVIATIONS[item.code] ?? item.name;
}

const ABBREVIATIONS: Record<string, string> = {
  competency_check: "Compt.",
  ipc: "IPC",
  night_ifr_approaches: "Night/IFR",
  pic_check: "PIC",
  cfit_training: "CFIT",
  crm_initial: "CRM Init",
  crm_recurrent: "CRM Rec",
  emergency_procedures: "Emerg",
  hazmat_awareness: "Hazmat",
  security_training: "Security",
  medical_certificate: "Medical",
  ifr_currency: "IFR Curr",
  day_landing_currency: "Day Ldg",
  night_landing_currency: "Nt Ldg",
  sic_day_landing_currency: "SIC Day",
  sic_night_landing_currency: "SIC Nt",
  sic_ifr_currency: "SIC IFR",
};
