import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ApiError } from "@/lib/api/client";
import {
  CAPA_STATUS_LABELS,
  type CapaStatus,
  type CorrectiveAction,
  listCapas,
} from "@/lib/api/safety";

const BOARD_ROLES = new Set(["safety_officer", "chief_pilot", "exec_admin"]);

const STATUS_FILTERS: Array<{ key: string; label: string; status?: CapaStatus }> = [
  { key: "open", label: "Open (default)" },
  { key: "in_progress", label: "In Progress", status: "in_progress" },
  { key: "closed", label: "Closed", status: "closed" },
  { key: "all", label: "All" },
];

/**
 * /safety/actions — CAPA board.
 *
 * Board roles only (Safety Officer / Chief Pilot / Exec Admin).
 * Non-board users hitting the URL get redirected to their /mine feed.
 * Backend also enforces the role gate; this redirect is just UX so
 * a pilot doesn't see a bare 403.
 *
 * Overdue filter toggle sits alongside the status chips. Sorting is
 * always soonest-due-first (matches backend default).
 */
export default async function CapaBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; overdue?: string }>;
}) {
  const session = await auth();
  const roles = new Set(session?.roles ?? []);
  const canRead = [...roles].some((r) => BOARD_ROLES.has(r));
  if (!canRead) redirect("/safety/actions/mine");

  const params = await searchParams;
  const filterKey = params.status ?? "open";
  const overdueOnly = params.overdue === "1";
  const activeFilter =
    STATUS_FILTERS.find((f) => f.key === filterKey) ?? STATUS_FILTERS[0];

  let items: CorrectiveAction[] = [];
  let total = 0;
  let loadError: string | null = null;
  try {
    if (activeFilter.key === "open") {
      // Synthesize "open" as everything except closed.
      const response = await listCapas({ limit: 200, overdue_only: overdueOnly });
      items = response.items.filter((c) => c.status !== "closed");
      total = items.length;
    } else if (activeFilter.key === "all") {
      const response = await listCapas({ limit: 200, overdue_only: overdueOnly });
      items = response.items;
      total = response.total;
    } else {
      const response = await listCapas({
        status: activeFilter.status,
        limit: 200,
        overdue_only: overdueOnly,
      });
      items = response.items;
      total = response.total;
    }
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "CAPA board unavailable. Try refreshing in a moment.";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            <Link href="/safety" className="hover:text-foreground">
              ← Safety SMS
            </Link>
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            Corrective Actions
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Follow-through tasks against hazards and incidents. Sorted
            soonest-due first.
          </p>
        </div>
        <Link
          href="/safety/actions/mine"
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-muted/20"
        >
          My Assignments
        </Link>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <nav
          aria-label="Filter by status"
          className="flex flex-wrap items-center gap-1.5"
        >
          {STATUS_FILTERS.map((f) => {
            const isActive = f.key === activeFilter.key;
            const params = new URLSearchParams();
            if (f.key !== "open") params.set("status", f.key);
            if (overdueOnly) params.set("overdue", "1");
            const qs = params.toString();
            const href = qs ? `/safety/actions?${qs}` : "/safety/actions";
            return (
              <Link
                key={f.key}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={
                  "rounded-md border px-2.5 py-1 text-xs font-semibold transition " +
                  (isActive
                    ? "border-status-blue bg-status-blue/15 text-status-blue"
                    : "border-border bg-card text-muted-foreground hover:text-foreground")
                }
              >
                {f.label}
              </Link>
            );
          })}
        </nav>
        <OverdueToggle overdueOnly={overdueOnly} filterKey={activeFilter.key} />
      </div>

      {loadError ? (
        <div
          role="alert"
          className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No corrective actions matching &ldquo;{activeFilter.label}&rdquo;
            {overdueOnly ? " (overdue only)" : ""}.
          </p>
          <p className="mt-2 text-xs text-muted-foreground/70">
            CAPAs are opened from a hazard or incident detail page.
          </p>
        </div>
      ) : (
        <CapaTable items={items} total={total} />
      )}
    </div>
  );
}

function OverdueToggle({
  overdueOnly,
  filterKey,
}: {
  overdueOnly: boolean;
  filterKey: string;
}) {
  const params = new URLSearchParams();
  if (filterKey !== "open") params.set("status", filterKey);
  if (!overdueOnly) params.set("overdue", "1");
  const href = params.toString()
    ? `/safety/actions?${params.toString()}`
    : "/safety/actions";
  return (
    <Link
      href={href}
      aria-pressed={overdueOnly}
      className={
        "rounded-md border px-2.5 py-1 text-xs font-semibold transition " +
        (overdueOnly
          ? "border-status-red bg-status-red/15 text-status-red"
          : "border-border bg-card text-muted-foreground hover:text-foreground")
      }
    >
      {overdueOnly ? "✓ Overdue only" : "Overdue only"}
    </Link>
  );
}

function CapaTable({
  items,
  total,
}: {
  items: CorrectiveAction[];
  total: number;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/10 text-left text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Due
              </th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Title
              </th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Source
              </th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Owner
              </th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Status
              </th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((c) => {
              const dueDate = new Date(c.due_date + "T00:00:00");
              const overdue = dueDate < today && c.status !== "closed";
              return (
                <tr key={c.id} className="hover:bg-muted/5">
                  <td className="whitespace-nowrap px-4 py-3 text-xs">
                    <span
                      className={
                        overdue
                          ? "font-bold text-status-red"
                          : "text-muted-foreground"
                      }
                    >
                      {dueDate.toLocaleDateString()}
                    </span>
                  </td>
                  <td className="max-w-md px-4 py-3 text-xs">
                    <p className="line-clamp-1 font-semibold text-foreground/90">
                      {c.title}
                    </p>
                    <p className="line-clamp-1 text-muted-foreground">
                      {c.description}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs">
                    <Link
                      href={
                        c.source_type === "hazard"
                          ? `/safety/${c.source_id}`
                          : `/safety/incidents/${c.source_id}`
                      }
                      className="text-status-blue hover:underline"
                    >
                      {c.source_type === "hazard" ? "Hazard" : "Incident"} →
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs">
                    {c.owner.full_name}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={
                        "inline-flex items-center rounded border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider " +
                        (c.status === "in_progress"
                          ? "border-status-yellow bg-status-yellow/15 text-status-yellow"
                          : c.status === "open"
                            ? "border-status-blue bg-status-blue/15 text-status-blue"
                            : "border-border bg-muted/20 text-muted-foreground")
                      }
                    >
                      {CAPA_STATUS_LABELS[c.status]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Link
                      href={`/safety/actions/${c.id}`}
                      className="text-xs font-semibold text-status-blue hover:underline"
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <footer className="border-t border-border px-4 py-2 text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
        {total} corrective action{total === 1 ? "" : "s"}
      </footer>
    </div>
  );
}
