import Link from "next/link";

import type {
  TypeQualificationCell,
  TypeQualificationPilot,
} from "@/lib/api/type-qualifications";

import {
  CELL_STATE_LABELS,
  CELL_TONES,
  CHECK_LABELS,
  POSITION_LABELS,
  POSITION_SHORT,
  typeLabel,
} from "./display";

/**
 * Presentational half of the aircraft qualifications page: every pilot
 * against every aircraft type, each cell listing the positions the pilot
 * is authorised to fly on that type, coloured by whether the type's check
 * rides are in date.
 *
 * The operator's 135ACM grid has a column per position under each type.
 * With five positions on each of the fleet's types that is twenty-five
 * columns or more, so here a type is one column and its positions are
 * chips inside it; the full grid with dates is on each pilot's page.
 */
export function QualificationGrid({
  airframeTypes,
  pilots,
}: {
  airframeTypes: string[];
  pilots: TypeQualificationPilot[];
}) {
  if (airframeTypes.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
        No aircraft types in the fleet yet. A type comes from the aircraft
        record.
      </p>
    );
  }
  if (pilots.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
        No pilots here.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <Th className="text-left">Pilot</Th>
            <Th className="text-left">Base</Th>
            {airframeTypes.map((t) => (
              <Th key={t} className="text-center font-mono">
                {typeLabel(t)}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pilots.map((row) => (
            <tr key={row.pilot.id} className="border-b border-border/60 last:border-0">
              <td className="whitespace-nowrap px-3 py-2">
                <Link
                  href={`/compliance/pilots/${row.pilot.id}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {row.pilot.full_name}
                </Link>
              </td>
              <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-muted-foreground">
                {row.station ?? "—"}
              </td>
              {airframeTypes.map((t) => {
                const held = row.cells.filter(
                  (c) => c.airframe_type === t && c.state !== "not_authorised",
                );
                return (
                  <td key={t} className="px-3 py-2 text-center">
                    {held.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className="inline-flex flex-wrap justify-center gap-1">
                        {held.map((c) => (
                          <PositionChip key={c.position} cell={c} />
                        ))}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PositionChip({ cell }: { cell: TypeQualificationCell }) {
  const lines = [
    `${POSITION_LABELS[cell.position]} on ${typeLabel(cell.airframe_type)}: ${CELL_STATE_LABELS[cell.state]}`,
    `Authorised ${cell.authorised_on}`,
    ...cell.checks.map(
      (c) =>
        `${CHECK_LABELS[c.check]}: ${c.last_on ? `last ${c.last_on}, due ${c.base_month_due?.slice(0, 7)}` : "not on file"}`,
    ),
  ];
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[0.65rem] font-semibold ${CELL_TONES[cell.state]}`}
      title={lines.join("\n")}
    >
      {POSITION_SHORT[cell.position]}
    </span>
  );
}

export function QualificationLegend() {
  return (
    <p className="mt-3 flex flex-wrap items-center gap-3 text-[0.7rem] text-muted-foreground">
      {(["current", "grace", "non_current"] as const).map((state) => (
        <span key={state} className="inline-flex items-center gap-1.5">
          <span className={`rounded px-1.5 py-0.5 font-semibold ${CELL_TONES[state]}`}>
            PIC
          </span>
          {CELL_STATE_LABELS[state]}
        </span>
      ))}
      <span>
        PIC · SIC · INS instructor · CA check airman · ADV advisory pilot
      </span>
    </p>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={`whitespace-nowrap px-3 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground ${className || "text-center"}`}
    >
      {children}
    </th>
  );
}
