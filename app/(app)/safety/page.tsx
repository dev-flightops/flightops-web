import Link from "next/link";

import { segment, segmentGroup } from "@/components/ff/controls";
import { cn } from "@/lib/utils";
import { hasAnyRole, roleGate } from "@/lib/roles";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ApiError } from "@/lib/api/client";
import {
  HAZARD_CATEGORY_LABELS,
  HAZARD_SEVERITY_LABELS,
  HAZARD_STATUS_LABELS,
  type HazardReport,
  listHazards,
} from "@/lib/api/safety";

/**
 * /safety — Safety SMS triage inbox.
 *
 * Roles: Safety Officer, Chief Pilot, Exec Admin. Backend enforces the
 * same list; the page-level check is UX (redirect a reporter to /safety/mine
 * instead of showing a 403 shell).
 *
 * Layout mirrors /stations and /ramp-ops:
 *   - Header with title + File Report / My Reports CTAs
 *   - Optional filter chips (status)
 *   - One-row-per-hazard table with severity + category chips
 *
 * Anonymity: rows where `is_anonymous=true` show "Anonymous" in the
 * reporter column for Chief Pilot; only Safety Officer / Exec Admin see
 * the real name (enforced by the backend response shape).
 */

const TRIAGE_ROLES = roleGate(
  "safety_officer",
  "chief_pilot",
  "director_of_operations",
  "exec_admin",
);

const STATUS_FILTERS: Array<{ key: string; label: string; status?: string }> = [
  { key: "open", label: "Open" },
  { key: "submitted", label: "Submitted", status: "submitted" },
  { key: "triaged", label: "Triaged", status: "triaged" },
  { key: "in_progress", label: "In Progress", status: "in_progress" },
  { key: "closed", label: "Closed", status: "closed" },
  { key: "all", label: "All" },
];

export default async function SafetyInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  const roles = new Set(session?.roles ?? []);
  const canTriage = hasAnyRole([...roles], TRIAGE_ROLES);
  if (!canTriage) {
    // Reporter without triage privileges — send them to their own feed.
    redirect("/safety/mine");
  }

  const params = await searchParams;
  const filterKey = params.status ?? "open";
  const activeFilter =
    STATUS_FILTERS.find((f) => f.key === filterKey) ?? STATUS_FILTERS[0];

  let hazards: HazardReport[] = [];
  let total = 0;
  let loadError: string | null = null;
  try {
    // "Open" is a synthetic filter — the backend has no combined "not
    // closed" status query, so we ask for the whole list and drop the
    // closed rows client-side. Cheap for the sizes SMS produces
    // (dozens per tenant per month, not thousands).
    if (activeFilter.key === "open") {
      const response = await listHazards({ limit: 200 });
      hazards = response.items.filter((h) => h.status !== "closed");
      total = hazards.length;
    } else if (activeFilter.key === "all") {
      const response = await listHazards({ limit: 200 });
      hazards = response.items;
      total = response.total;
    } else {
      const response = await listHazards({
        // biome-ignore lint/style/noNonNullAssertion: STATUS_FILTERS entries with key != "open"/"all" always carry a status
        status: activeFilter.status as HazardReport["status"],
        limit: 200,
      });
      hazards = response.items;
      total = response.total;
    }
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Safety inbox unavailable. Try refreshing in a moment.";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="page-title">Safety SMS</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Hazard triage inbox — Part 5 SMS reports awaiting review.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/safety/dashboard"
            className="btn-caps rounded-md border border-input px-3 py-1.5 text-foreground hover:bg-accent text-[0.72rem]"
          >
            Dashboard
          </Link>
          <Link
            href="/safety/mine"
            className="btn-caps rounded-md border border-input px-3 py-1.5 text-foreground hover:bg-accent text-[0.72rem]"
          >
            My Reports
          </Link>
          <Link
            href="/safety/report"
            className="btn-caps rounded-md border border-input px-3 py-1.5 text-foreground hover:border-foreground text-[0.72rem]"
          >
            + File a Hazard
          </Link>
        </div>
      </header>

      <StatusFilterBar active={activeFilter.key} />

      {loadError ? (
        <div
          role="alert"
          className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      ) : hazards.length === 0 ? (
        <EmptyState filter={activeFilter.label} />
      ) : (
        <HazardTable hazards={hazards} total={total} />
      )}
    </div>
  );
}

function StatusFilterBar({ active }: { active: string }) {
  return (
    <nav
      aria-label="Filter by status"
      className={cn(segmentGroup, "mb-4")}
    >
      {STATUS_FILTERS.map((f) => {
        const isActive = f.key === active;
        return (
          <Link
            key={f.key}
            href={f.key === "open" ? "/safety" : `/safety?status=${f.key}`}
            aria-current={isActive ? "page" : undefined}
            className={segment(isActive)}
          >
            {f.label}
          </Link>
        );
      })}
    </nav>
  );
}

function EmptyState({ filter }: { filter: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-16 text-center">
      <p className="text-sm text-muted-foreground">
        No hazards matching &ldquo;{filter}&rdquo;.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        A clean board is a good day. Filed hazards land here as soon as
        they&rsquo;re submitted.
      </p>
    </div>
  );
}

function HazardTable({
  hazards,
  total,
}: {
  hazards: HazardReport[];
  total: number;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="ff-thead">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Filed
              </th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Severity
              </th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Category
              </th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Reporter
              </th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Description
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
            {hazards.map((h) => (
              <tr key={h.id} className="hover:bg-accent">
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {formatFiledDate(h.created_at)}
                </td>
                <td className="px-4 py-3">
                  <SeverityChip severity={h.severity} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs">
                  {HAZARD_CATEGORY_LABELS[h.category]}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs">
                  {h.is_anonymous && !h.reporter ? (
                    <span className="italic text-muted-foreground">
                      Anonymous
                    </span>
                  ) : (
                    <span>{h.reporter?.full_name ?? "—"}</span>
                  )}
                </td>
                <td className="max-w-md px-4 py-3 text-xs">
                  <p className="line-clamp-2 text-foreground/90">
                    {h.description}
                  </p>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusChip status={h.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <Link
                    href={`/safety/${h.id}`}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="eyebrow border-t border-border px-4 py-2">
        {total} hazard{total === 1 ? "" : "s"}
      </footer>
    </div>
  );
}

function formatFiledDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function SeverityChip({ severity }: { severity: HazardReport["severity"] }) {
  const cls =
    severity === "critical"
      ? "text-status-red"
      : severity === "high"
        ? "text-status-red"
        : severity === "medium"
          ? "text-status-yellow"
          : "text-muted-foreground";
  return (
    <span
      className={
        "status-mark text-[0.65rem] " +
        cls
      }
    >
      {HAZARD_SEVERITY_LABELS[severity]}
    </span>
  );
}

function StatusChip({ status }: { status: HazardReport["status"] }) {
  const cls =
    status === "submitted"
      ? "text-status-blue"
      : status === "triaged"
        ? "text-status-yellow"
        : status === "in_progress"
          ? "text-status-yellow"
          : "text-muted-foreground";
  return (
    <span
      className={
        "status-mark text-[0.65rem] " +
        cls
      }
    >
      {HAZARD_STATUS_LABELS[status]}
    </span>
  );
}
