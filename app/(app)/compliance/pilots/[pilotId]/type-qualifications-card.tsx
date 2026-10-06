"use client";

import { useState } from "react";

import type {
  PilotTypeQualifications,
  TypeCheck,
  TypeCheckStanding,
  TypeQualificationCell,
} from "@/lib/api/type-qualifications";

import { STATUS_TOKENS } from "../../crew-currency/status-tokens";
import {
  CELL_STATE_LABELS,
  CELL_TONES,
  CHECK_LABELS,
  POSITION_LABELS,
  TYPE_POSITIONS,
  typeLabel,
} from "../../type-qualifications/display";
import {
  TypeQualificationDialogs,
  type CheckItemRef,
  type TypeDialog,
} from "./type-qualification-dialogs";

const CHECKS: TypeCheck[] = ["competency", "instrument"];

/**
 * Aircraft qualifications (#45) — legacy's panel of the same name on the
 * crew record, laid out as the operator's 135ACM grid: one row per
 * aircraft type, a dated cell per position, and the two check rides the
 * positions hang on.
 *
 * Deliberate deviation from legacy: there is no expiry date to type in.
 * Legacy kept a hand-entered "Expires" per row; here a position is
 * current while the type's checks are — a competency check (135.293)
 * within 12 calendar months, and for the PIC an instrument check
 * (135.297) within 6 — so the date comes from the check ride record.
 */
export function TypeQualificationsCard({
  data,
  checkItems,
  canAuthorise,
  canRecordCheck,
}: {
  data: PilotTypeQualifications;
  checkItems: Record<TypeCheck, CheckItemRef | null>;
  /** TYPE_QUALIFICATION_ADMINS: Chief Pilot, DO, Exec Admin. */
  canAuthorise: boolean;
  /** CURRENCY_SIGNOFF: a check ride is a currency sign-off. */
  canRecordCheck: boolean;
}) {
  const [dialog, setDialog] = useState<TypeDialog | null>(null);
  const pilot = data.pilot.pilot;
  const cells = new Map(
    data.pilot.cells.map((c) => [`${c.airframe_type}/${c.position}`, c]),
  );
  const firstType = data.airframe_types[0] ?? "";

  return (
    <section aria-labelledby="aircraft-quals-heading" className="mt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2
          id="aircraft-quals-heading"
          className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground"
        >
          Aircraft qualifications
        </h2>
        {data.airframe_types.length > 0 && (canAuthorise || canRecordCheck) && (
          <div className="flex gap-2">
            {canRecordCheck && (
              <button
                type="button"
                onClick={() =>
                  setDialog({ kind: "check", airframeType: firstType, check: "competency" })
                }
                className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent"
              >
                Record check ride
              </button>
            )}
            {canAuthorise && (
              <button
                type="button"
                onClick={() =>
                  setDialog({ kind: "authorise", airframeType: firstType, position: "pic" })
                }
                className="rounded-md border border-primary/40 bg-background px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5"
              >
                + Authorise
              </button>
            )}
          </div>
        )}
      </div>

      {data.airframe_types.length === 0 ? (
        <p className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          No aircraft types in the fleet yet. A type comes from the aircraft
          record.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                <Th className="text-left">Type</Th>
                {TYPE_POSITIONS.map((p) => (
                  <Th key={p}>{POSITION_LABELS[p]}</Th>
                ))}
                <Th>Competency · 135.293</Th>
                <Th>Instrument · 135.297 (PIC)</Th>
              </tr>
            </thead>
            <tbody>
              {data.airframe_types.map((t) => {
                // Every position carries the checks it needs; the PIC
                // needs both, so its cell has the type's two standings.
                const pic = cells.get(`${t}/pic`);
                return (
                  <tr key={t} className="border-b border-border/60 last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-semibold">
                      {typeLabel(t)}
                    </td>
                    {TYPE_POSITIONS.map((p) => {
                      const cell = cells.get(`${t}/${p}`);
                      return (
                        <td key={p} className="px-2 py-2 text-center">
                          {cell ? (
                            <PositionCell
                              cell={cell}
                              canAuthorise={canAuthorise}
                              onAuthorise={() =>
                                setDialog({ kind: "authorise", airframeType: t, position: p })
                              }
                              onRevoke={() => setDialog({ kind: "revoke", cell })}
                            />
                          ) : (
                            "—"
                          )}
                        </td>
                      );
                    })}
                    {CHECKS.map((check) => (
                      <td key={check} className="px-3 py-2">
                        <CheckCell
                          standing={pic?.checks.find((c) => c.check === check) ?? null}
                          label={`${CHECK_LABELS[check]} on ${typeLabel(t)}`}
                          onRecord={
                            canRecordCheck
                              ? () => setDialog({ kind: "check", airframeType: t, check })
                              : null
                          }
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <History data={data} />

      <TypeQualificationDialogs
        dialog={dialog}
        onClose={() => setDialog(null)}
        pilotId={pilot.id}
        pilotName={pilot.full_name}
        airframeTypes={data.airframe_types}
        checkItems={checkItems}
      />
    </section>
  );
}

function PositionCell({
  cell,
  canAuthorise,
  onAuthorise,
  onRevoke,
}: {
  cell: TypeQualificationCell;
  canAuthorise: boolean;
  onAuthorise: () => void;
  onRevoke: () => void;
}) {
  const what = `${POSITION_LABELS[cell.position]} on ${typeLabel(cell.airframe_type)}`;
  if (cell.state === "not_authorised") {
    return canAuthorise ? (
      <button
        type="button"
        onClick={onAuthorise}
        aria-label={`Authorise ${what}`}
        title={`Authorise ${what}`}
        className="rounded px-2 text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        +
      </button>
    ) : (
      <span className="text-muted-foreground" aria-label={`${what}: not authorised`}>
        —
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5">
      <span
        className={`rounded px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold ${CELL_TONES[cell.state]}`}
        title={`${what}: ${CELL_STATE_LABELS[cell.state]} — authorised ${cell.authorised_on}`}
      >
        {cell.authorised_on}
      </span>
      {canAuthorise && (
        <button
          type="button"
          onClick={onRevoke}
          aria-label={`Revoke ${what}`}
          title={`Revoke ${what}`}
          className="rounded px-1 text-xs text-muted-foreground hover:bg-accent hover:text-status-red"
        >
          &times;
        </button>
      )}
    </span>
  );
}

function CheckCell({
  standing,
  label,
  onRecord,
}: {
  standing: TypeCheckStanding | null;
  label: string;
  onRecord: (() => void) | null;
}) {
  const token = standing ? STATUS_TOKENS[standing.status] : null;
  return (
    <div className="flex items-start justify-between gap-2 text-[0.7rem]">
      <div className="min-w-0">
        {standing?.last_on ? (
          <>
            <span className={token?.pill}>{token?.label}</span>
            <p className="mt-1 whitespace-nowrap font-mono text-muted-foreground">
              Last {standing.last_on}
            </p>
            <p className="whitespace-nowrap text-muted-foreground">
              Due {formatMonth(standing.base_month_due)}
            </p>
          </>
        ) : (
          <span className="text-muted-foreground">Not on file</span>
        )}
      </div>
      {onRecord && (
        <button
          type="button"
          onClick={onRecord}
          aria-label={`Record ${label}`}
          title={`Record ${label}`}
          className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[0.65rem] font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          Record
        </button>
      )}
    </div>
  );
}

function History({ data }: { data: PilotTypeQualifications }) {
  const { authorisations, checks } = data;
  if (authorisations.length === 0 && checks.length === 0) return null;
  return (
    <details className="mt-2 rounded-lg border border-border bg-card px-4 py-2 text-xs">
      <summary className="cursor-pointer font-semibold text-muted-foreground">
        History — {authorisations.length} authorisation
        {authorisations.length === 1 ? "" : "s"}, {checks.length} check ride
        {checks.length === 1 ? "" : "s"}
      </summary>
      {authorisations.length > 0 && (
        <ul className="mt-2 space-y-1">
          {authorisations.map((a) => (
            <li key={a.id} className={a.revoked_on ? "text-muted-foreground" : ""}>
              <span className="font-semibold">
                {POSITION_LABELS[a.position]} · {typeLabel(a.airframe_type)}
              </span>{" "}
              authorised <span className="font-mono">{a.authorised_on}</span>
              {a.authorised_by ? ` by ${a.authorised_by.full_name}` : ""}
              {a.revoked_on && (
                <>
                  {" "}— revoked <span className="font-mono">{a.revoked_on}</span>
                  {a.revoked_by ? ` by ${a.revoked_by.full_name}` : ""}
                </>
              )}
              {a.notes ? <span className="text-muted-foreground"> — {a.notes}</span> : null}
            </li>
          ))}
        </ul>
      )}
      {checks.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-border/60 pt-2">
          {checks.map((c) => (
            <li key={c.completion_id}>
              <span className="font-mono">{c.completion_date}</span>{" "}
              <span className="font-semibold">
                {typeLabel(c.airframe_type)} · {CHECK_LABELS[c.check]}
              </span>{" "}
              <span className={c.result === "fail" ? "font-semibold text-status-red" : ""}>
                {c.result === "fail" ? "Fail" : c.result === "pass" ? "Pass" : ""}
              </span>
              {" — "}
              {c.completed_by}
              {c.examiner_cert_number ? ` (cert ${c.examiner_cert_number})` : ""}
              {c.notes ? <span className="text-muted-foreground"> — {c.notes}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={`whitespace-nowrap px-3 py-2 text-center text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground ${className}`}
    >
      {children}
    </th>
  );
}

function formatMonth(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    year: "numeric",
  });
}
