import type { ReactNode } from "react";

import { StatusMark, type StatusTone } from "@/components/ff/status-mark";
import type { TestRecord } from "@/lib/api/drug-alcohol";
import { ALCOHOL_REFUSALS, DRUG_CLASSES, DRUG_REFUSALS, FILE_KINDS, labelOf } from "@/lib/drug-alcohol/options";
import { localDateTime } from "@/lib/format/local-time";
import { formatIsoDay } from "@/lib/iso-day";

/**
 * A person's tests, legacy's Test History table: the date, type, panel and
 * result, what the result rests on, who collected and reviewed it, and its
 * documents. Shown to whoever runs the program and to the person tested.
 */

function tone(t: TestRecord): StatusTone {
  if (t.result === null) return "yellow";
  if (t.violation) return "red";
  if (t.result === "alcohol_02") return "orange";
  if (t.result === "cancelled") return "muted";
  return "green";
}

function level(n: number | null): string {
  return n === null ? "—" : n.toFixed(3);
}

export function resultDetail(t: TestRecord, zone: string): string[] {
  const lines: string[] = [];
  if (t.drugs.length > 0) lines.push(`Found: ${t.drugs.map((d) => labelOf(DRUG_CLASSES, d)).join(", ")}`);
  if (t.refusal_reason) {
    lines.push(labelOf(t.panel === "drug" ? DRUG_REFUSALS : ALCOHOL_REFUSALS, t.refusal_reason));
  }
  if (t.panel === "alcohol" && t.screening_level !== null) {
    lines.push(
      `Screening ${level(t.screening_level)}${t.confirmation_level !== null ? ` · confirmation ${level(t.confirmation_level)}` : ""}`,
    );
  }
  if (t.result === "alcohol_02") {
    lines.push(
      t.returned_to_duty_at
        ? `Back on duty ${localDateTime(t.returned_to_duty_at, zone)}${t.returned_to_duty_by ? `, ${t.returned_to_duty_by.full_name}` : ""}`
        : `Off duty: not before ${t.hold_ends_at ? localDateTime(t.hold_ends_at, zone) : "8 hours after the test"}`,
    );
  }
  return lines;
}

export function TestsTable({
  tests,
  zone,
  showName = false,
  actions,
}: {
  tests: TestRecord[];
  zone: string;
  showName?: boolean;
  /** Whoever runs the program: edit, return to duty, attach. */
  actions?: (t: TestRecord) => ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="ff-table w-full text-sm">
        <thead className="ff-thead">
          <tr>
            <th>Date</th>
            {showName ? <th>Employee</th> : null}
            <th>Type</th>
            <th>Panel</th>
            <th>Result</th>
            <th>Collected / Reviewed</th>
            <th>Documents</th>
            {actions ? (
              <th>
                <span className="sr-only">Actions</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {tests.map((t) => (
            <tr key={t.id} className={t.violation ? "border-l-[3px] border-l-status-red" : undefined}>
              <td className="whitespace-nowrap text-xs">
                {formatIsoDay(t.test_date)}
                {t.collected_at ? (
                  <span className="block text-muted-foreground">{localDateTime(t.collected_at, zone).split(", ").pop()}</span>
                ) : null}
              </td>
              {showName ? <td className="font-semibold">{t.full_name ?? "—"}</td> : null}
              <td className="text-xs">
                {t.test_type_label}
                <span className="block text-muted-foreground">{t.category_label}</span>
              </td>
              <td className="text-xs capitalize">{t.panel}</td>
              <td className="text-xs">
                <StatusMark label={t.result_label} tone={tone(t)} />
                {resultDetail(t, zone).map((line) => (
                  <span key={line} className="mt-0.5 block text-muted-foreground">
                    {line}
                  </span>
                ))}
              </td>
              <td className="text-xs">
                {[t.collection_site?.name, t.mro?.name, t.lab?.name].filter(Boolean).join(" · ") || "—"}
                {t.specimen_id ? <span className="block font-mono text-muted-foreground">CCF {t.specimen_id}</span> : null}
              </td>
              <td className="text-xs">
                {t.files.length === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  t.files.map((f) => (
                    <a
                      key={f.id}
                      href={`/api/drug-alcohol/files/${f.id}/download`}
                      className="block font-medium text-primary hover:underline"
                    >
                      {labelOf(FILE_KINDS, f.kind)}
                      <span className="sr-only">: {f.original_filename}</span>
                    </a>
                  ))
                )}
              </td>
              {actions ? <td className="text-right">{actions(t)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
