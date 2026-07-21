import Link from "next/link";

import { getCurrentDuty, listDutyHistory } from "@/lib/api/ops";
import { ApiError } from "@/lib/api/client";
import type {
  CurrentDutyResponse,
  DutyPeriodSummary,
} from "@/lib/api/types";

/**
 * /time-clock — Employee time-clock surface.
 *
 * Legacy peregrineflight.com/time-clock/ 404s — the HR sub-nav lists
 * a "Time Clock" chip but the URL is a placeholder there. This page
 * fills that gap by rendering a status card + recent-punches history
 * over the existing ops-service duty API (which already backs pilot
 * clock-in/out via /flight-crew/elog).
 *
 *   Sub-nav: 🏠 › HR · Payroll · Time Clock (active) · Records
 *            (auto-rendered by DepartmentNav — /time-clock is in the
 *            "hr" dept's pathPrefixes from #164)
 *   Header:  "Time Clock" + status subtitle
 *   Body:    Current-status card + Recent Punches table (last 10)
 *
 * Clock In/Out actions themselves live on the header's Clock In
 * button + the /flight-crew/elog surface — this page is read-only
 * (view your status + history). Ship the write actions here once
 * the header Clock In button flips from disabled (currently M3
 * placeholder in the header cluster).
 */
export const dynamic = "force-dynamic";

export default async function TimeClockPage() {
  let current: CurrentDutyResponse | null = null;
  let history: DutyPeriodSummary[] = [];
  let loadError: string | null = null;
  try {
    const [c, h] = await Promise.all([
      getCurrentDuty(),
      listDutyHistory({ limit: 10 }),
    ]);
    current = c;
    history = h.items;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : status === 403
          ? "You don't have permission to view time-clock records."
          : "Time-clock records unavailable. Try refreshing in a moment.";
  }

  const open = current?.open ?? null;

  return (
    <div className="w-full px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Time Clock</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {open
              ? `On duty since ${formatTime(open.clock_in_at)} — ${open.elapsed_hours.toFixed(1)}h`
              : "Not on duty"}
          </p>
        </div>
        <Link
          href="/flight-crew/elog"
          className="rounded-md bg-status-blue px-3 py-2 text-xs font-semibold text-white hover:brightness-110"
        >
          Open Flight Log →
        </Link>
      </header>

      {loadError ? (
        <div
          role="alert"
          className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-3 text-xs text-status-yellow"
        >
          {loadError}
        </div>
      ) : (
        <>
          <StatusCard current={current} />
          <RecentPunches history={history} />
        </>
      )}
    </div>
  );
}

function StatusCard({ current }: { current: CurrentDutyResponse | null }) {
  if (!current) return null;
  const open = current.open;
  return (
    <div className="mb-6 rounded-lg border border-border bg-card px-4 py-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatItem
          label="Status"
          value={open ? "On duty" : "Off duty"}
          accent={open ? "green" : "gray"}
        />
        <StatItem
          label={open ? "Clocked in" : "Last clocked out"}
          value={
            open
              ? formatDateTime(open.clock_in_at)
              : current.last_closed
                ? formatDateTime(current.last_closed.clock_out_at ?? "")
                : "—"
          }
        />
        <StatItem
          label="Elapsed"
          value={
            open
              ? `${open.elapsed_hours.toFixed(1)}h`
              : current.last_closed
                ? `${current.last_closed.elapsed_hours.toFixed(1)}h`
                : "—"
          }
        />
        <StatItem
          label="Max duty · Min rest"
          value={`${current.max_duty_hours}h · ${current.min_rest_hours}h`}
        />
      </div>
      {current.warnings.length > 0 && (
        <ul className="mt-3 space-y-1">
          {current.warnings.map((w, i) => (
            <li
              key={i}
              className={
                "rounded px-2 py-1 text-xs " +
                (w.level === "red"
                  ? "bg-status-red/15 text-status-red"
                  : "bg-status-yellow/15 text-status-yellow")
              }
            >
              {w.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatItem({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "green" | "gray";
}) {
  return (
    <div>
      <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
      <div
        className={
          "mt-1 text-sm font-semibold " +
          (accent === "green"
            ? "text-status-green"
            : accent === "gray"
              ? "text-muted-foreground"
              : "text-foreground")
        }
      >
        {value}
      </div>
    </div>
  );
}

function RecentPunches({ history }: { history: DutyPeriodSummary[] }) {
  if (history.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          No time-clock punches yet. Clock in via the top-right button to
          start a duty period.
        </p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-2 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Recent punches
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/10 text-left text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-semibold">Clock in</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Clock out</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Elapsed</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {history.map((p) => (
              <tr key={p.id} className="hover:bg-muted/5">
                <td className="whitespace-nowrap px-4 py-3 text-xs text-foreground">
                  {formatDateTime(p.clock_in_at)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {p.clock_out_at ? formatDateTime(p.clock_out_at) : "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {p.elapsed_hours.toFixed(1)}h
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span
                    className={
                      "rounded border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider " +
                      (p.is_open
                        ? "border-status-green/40 bg-status-green/10 text-status-green"
                        : "border-border bg-muted/30 text-muted-foreground")
                    }
                  >
                    {p.is_open ? "Open" : "Closed"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
