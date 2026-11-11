import Link from "next/link";

import { Notice } from "@/components/ff/notice";
import { PageHeader } from "@/components/ff/page-header";
import { Panel } from "@/components/ff/panel";
import { StatusMark } from "@/components/ff/status-mark";
import { loadZoneTable } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { getSelection, type SelectionDetail } from "@/lib/api/drug-alcohol";
import { ENTRY_STATUS_LABEL, PANEL_LABEL, categoryLabel } from "@/lib/drug-alcohol/options";
import { localDateTime } from "@/lib/format/local-time";
import { formatIsoDay } from "@/lib/iso-day";

import { EntryButtons } from "./entry-buttons";

/**
 * One random selection, legacy's selection_detail: when and how it was made,
 * the pool it was drawn from and the seed that drew it (the same seed over
 * the same pool picks the same people), and each person picked: told,
 * tested, or excused with the reason.
 */

export const dynamic = "force-dynamic";

const TONE = { selected: "yellow", notified: "blue", tested: "green", excused: "muted" } as const;

export default async function SelectionPage({ params }: { params: Promise<{ selectionId: string }> }) {
  const { selectionId } = await params;
  let s: SelectionDetail | null = null;
  let loadError: string | null = null;
  try {
    s = await getSelection(selectionId);
  } catch (err) {
    loadError =
      err instanceof ApiError && err.status === 404
        ? "That selection isn't on file."
        : err instanceof ApiError && err.status === 403
          ? "Random selections are for the program's DER, the alternate DER and the Exec Admins."
          : "The selection is unavailable. Try refreshing in a moment.";
  }
  const zone = (await loadZoneTable()).fallback;
  const back = { href: "/employees/drug-alcohol/pool", label: "Random Pool" };

  if (!s) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <PageHeader title="Random Selection" back={back} />
        <Notice tone="yellow" role="alert">
          {loadError}
        </Notice>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Random Selection"
        back={back}
        description={`${PANEL_LABEL[s.panel]} · ${localDateTime(s.selected_at, zone, { withYear: true })}${s.period_label ? ` · ${s.period_label}` : ""}`}
      />
      <dl className="mb-6 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="eyebrow">Made</dt>
          <dd>
            {s.method === "drawn" ? "Drawn here" : `Entered from ${s.source}`}
            {s.selected_by ? `, by ${s.selected_by.full_name}` : ""}
          </dd>
        </div>
        <div>
          <dt className="eyebrow">Selected</dt>
          <dd className="tabular-nums">
            {s.selected_count} of the {s.pool_size} in the pool
          </dd>
        </div>
        <div>
          <dt className="eyebrow">Still to Test</dt>
          <dd className="tabular-nums">{s.open ?? 0}</dd>
        </div>
        {s.notes ? (
          <div className="sm:col-span-3">
            <dt className="eyebrow">Notes</dt>
            <dd className="whitespace-pre-wrap">{s.notes}</dd>
          </div>
        ) : null}
      </dl>

      <Notice tone="blue" className="mb-5">
        Random tests are unannounced: tell each person when they&rsquo;re sent to test, and record it here. Once told,
        they go straight to the collection site.
      </Notice>

      <div className="mb-8 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="ff-table w-full text-sm">
          <thead className="ff-thead">
            <tr>
              <th>Employee</th>
              <th>Panel</th>
              <th>Status</th>
              <th>Notified</th>
              <th>Test</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {s.entries.map((e) => (
              <tr key={e.id}>
                <td>
                  <Link href={`/employees/drug-alcohol/employees/${e.user_id}`} className="font-semibold hover:underline">
                    {e.full_name}
                  </Link>
                </td>
                <td className="text-xs">{PANEL_LABEL[e.panel]}</td>
                <td className="text-xs">
                  <StatusMark label={ENTRY_STATUS_LABEL[e.status]} tone={TONE[e.status]} />
                  {e.excused_reason ? <span className="mt-0.5 block text-muted-foreground">{e.excused_reason}</span> : null}
                </td>
                <td className="whitespace-nowrap text-xs">
                  {e.notified_at ? localDateTime(e.notified_at, zone) : "—"}
                  {e.notified_by ? <span className="block text-muted-foreground">{e.notified_by.full_name}</span> : null}
                </td>
                <td className="text-xs">
                  {e.test ? `${formatIsoDay(e.test.test_date)} · ${e.test.result_label}` : "—"}
                </td>
                <td className="text-right">
                  <EntryButtons selectionId={s.id} entry={e} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Panel title={`The Pool Drawn From (${s.pool_size})`}>
        {s.seed ? (
          <p className="mb-3 break-all text-xs text-muted-foreground">
            Seed <span className="font-mono">{s.seed}</span>. Drawn over the pool below in this order: the same seed over
            the same pool picks the same people.
          </p>
        ) : (
          <p className="mb-3 text-xs text-muted-foreground">
            The pool FlightOps had when the list was entered. The consortium drew from its own.
          </p>
        )}
        <ol className="grid list-decimal gap-x-6 gap-y-1 pl-5 text-sm sm:grid-cols-2">
          {s.pool.map((p) => (
            <li key={p.user_id}>
              {p.full_name ?? "—"} <span className="text-xs text-muted-foreground">· {categoryLabel(p.category)}</span>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}
