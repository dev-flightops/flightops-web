import Link from "next/link";

import { linkCaps } from "@/components/ff/controls";
import { EmptyState } from "@/components/ff/empty-state";
import { Notice } from "@/components/ff/notice";
import { PageHeader } from "@/components/ff/page-header";
import { Panel } from "@/components/ff/panel";
import { StatusMark } from "@/components/ff/status-mark";
import { loadZoneTable } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { getPool, listSelections, type Pool, type PoolPerson, type SelectionRow } from "@/lib/api/drug-alcohol";
import { PANEL_LABEL, categoryLabel } from "@/lib/drug-alcohol/options";
import { localDate } from "@/lib/format/local-time";
import { formatRole } from "@/lib/roles";

import { DatNav } from "../dat-nav";
import { PersonEditor } from "./person-editor";
import { SelectionForm } from "./selection-form";

/**
 * /employees/drug-alcohol/pool, legacy's Random Pool: the safety-sensitive
 * employees subject to random testing, by role, with anyone added or left
 * out; the random selections; and a new one, drawn here or entered from a
 * consortium's list. Whoever runs the program only.
 */

export const dynamic = "force-dynamic";

const WHY: Record<PoolPerson["why"], { label: string; tone: "green" | "blue" | "yellow" | "muted" }> = {
  role: { label: "In · by role", tone: "green" },
  added: { label: "In · added", tone: "blue" },
  left_out: { label: "Left out", tone: "yellow" },
  not_covered: { label: "Not in the pool", tone: "muted" },
};

export default async function PoolPage() {
  let pool: Pool | null = null;
  let selections: SelectionRow[] = [];
  let loadError: string | null = null;
  try {
    [pool, { items: selections }] = await Promise.all([getPool(), listSelections()]);
  } catch (err) {
    loadError =
      err instanceof ApiError && err.status === 403
        ? "The random pool is for the program's DER, the alternate DER and the Exec Admins."
        : err instanceof ApiError && err.status === 401
          ? "Your session expired — please sign in again."
          : "The random pool is unavailable. Try refreshing in a moment.";
  }
  const zone = (await loadZoneTable()).fallback;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Random Testing Pool"
        back={{ href: "/employees/drug-alcohol", label: "Drug & Alcohol" }}
        description="Safety-sensitive employees subject to random DOT drug and alcohol testing"
      />
      <DatNav active="pool" />
      {loadError || !pool ? (
        <Notice tone="yellow" role="alert">
          {loadError ?? "The random pool is unavailable."}
        </Notice>
      ) : (
        <>
          <Panel title="New Random Selection" className="mb-6">
            <SelectionForm
              poolSize={pool.pool_size}
              people={pool.people.filter((p) => p.in_pool).map((p) => ({ id: p.user_id, full_name: p.full_name }))}
            />
          </Panel>

          <h2 className="section-title mb-1">Random Selections</h2>
          {selections.length === 0 ? (
            <EmptyState className="mb-8">No random selections yet.</EmptyState>
          ) : (
            <div className="mb-8 overflow-x-auto rounded-lg border border-border bg-card">
              <table className="ff-table w-full text-sm">
                <thead className="ff-thead">
                  <tr>
                    <th>Date</th>
                    <th>Panel</th>
                    <th>Period</th>
                    <th className="text-right">Selected</th>
                    <th>How</th>
                    <th>Open</th>
                    <th>
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selections.map((s) => (
                    <tr key={s.id}>
                      <td className="whitespace-nowrap text-xs">{localDate(s.selected_at, zone, { withYear: true })}</td>
                      <td className="text-xs">{PANEL_LABEL[s.panel]}</td>
                      <td className="text-xs">{s.period_label ?? "—"}</td>
                      <td className="text-right tabular-nums">
                        {s.selected_count} of {s.pool_size}
                      </td>
                      <td className="text-xs">
                        {s.method === "drawn" ? `Drawn${s.selected_by ? ` by ${s.selected_by.full_name}` : ""}` : `From ${s.source}`}
                      </td>
                      <td className="text-xs">
                        {s.open ? <StatusMark label={`${s.open} to test`} tone="yellow" /> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="text-right">
                        <Link href={`/employees/drug-alcohol/selections/${s.id}`} className={linkCaps}>
                          Open<span className="sr-only"> the selection of {localDate(s.selected_at, zone)}</span>{" "}
                          <span aria-hidden>›</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2 className="section-title mb-1">Pool Members ({pool.pool_size})</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            In by role: {pool.safety_sensitive_roles.map(formatRole).join(", ") || "none"} (change the roles on the Program
            tab). Add anyone else who does safety-sensitive work, or leave someone out while they&rsquo;re away, with the
            reason.
          </p>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="ff-table w-full text-sm">
              <thead className="ff-thead">
                <tr>
                  <th>Employee</th>
                  <th>Pool</th>
                  <th>FAA Category</th>
                  <th>Cleared</th>
                  <th>
                    <span className="sr-only">Change</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pool.people.map((p) => (
                  <tr key={p.user_id} className={p.covered ? undefined : "text-muted-foreground"}>
                    <td>
                      <Link href={`/employees/drug-alcohol/employees/${p.user_id}`} className="font-semibold hover:underline">
                        {p.full_name}
                      </Link>
                      <span className="block text-xs text-muted-foreground">{p.roles.map(formatRole).join(", ")}</span>
                    </td>
                    <td className="text-xs">
                      <StatusMark label={WHY[p.why].label} tone={WHY[p.why].tone} />
                      {p.pool_note ? <span className="mt-0.5 block text-muted-foreground">{p.pool_note}</span> : null}
                    </td>
                    <td className="text-xs">{p.category ? <CategoryText person={p} /> : <span className="text-status-yellow">Not set</span>}</td>
                    <td className="text-xs">
                      {!p.covered || !p.clearance ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <StatusMark label={p.clearance.cleared ? "Cleared" : "Not cleared"} tone={p.clearance.cleared ? "green" : "red"} />
                      )}
                    </td>
                    <td className="text-right">
                      <PersonEditor person={p} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function CategoryText({ person }: { person: PoolPerson }) {
  return (
    <span>
      {categoryLabel(person.category)}
      {person.category_set ? null : <span className="block text-muted-foreground">from their role</span>}
    </span>
  );
}
