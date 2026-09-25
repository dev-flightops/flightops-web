"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { OperationalAlert } from "@/lib/dashboards/operational-snapshot";

import type { DismissResult } from "./notifications-actions";

/**
 * The top-bar bell. Was a disabled "Coming in M3" placeholder.
 *
 * WHAT IT SHOWS
 *
 * The same alerts the home page and the four dashboards show, filtered
 * to the ones this user has not dismissed. Not a second alert feed:
 * one derivation means the bell and the Active Alerts panel cannot
 * disagree about what is wrong.
 *
 * WHY THE COUNT IS RED ONLY FOR RED
 *
 * A badge that is always red teaches people to ignore it. The count
 * takes the colour of the worst alert behind it, so a bell showing
 * three yellow MELs looks different from one showing a grounded
 * aircraft.
 *
 * DISMISSED IS NOT GONE
 *
 * An alert a dispatcher cleared is still true — the aircraft is still
 * grounded — so the panel says how many are hidden and links to the
 * unfiltered list. Hiding without saying so would make the bell a
 * worse picture of the operation than the dashboards it draws from.
 *
 * There is no un-dismiss control here. The home page's Active Alerts
 * panel is already the unfiltered view, so a second place to restore
 * them would be a second answer to "what is outstanding". The DELETE
 * endpoint exists and is tested; nothing calls it yet, and that is
 * better than a half-built toggle.
 *
 * And a dismissal covers an occurrence, not an id: ground an aircraft,
 * dismiss, return it to service, ground it again, and it comes back.
 * See lib/dashboards/unacknowledged-alerts.ts.
 */

const SEVERITY_DOT: Record<OperationalAlert["severity"], string> = {
  red: "bg-status-red",
  yellow: "bg-status-yellow",
};

export function NotificationsBell({
  alerts,
  dismissedCount,
  filterUnavailable,
  dismissAction,
}: {
  alerts: OperationalAlert[];
  dismissedCount: number;
  /** True when the dismissal list could not be read. The panel says the
   *  view is unfiltered rather than implying nothing was dealt with. */
  filterUnavailable: boolean;
  dismissAction: (
    alertKey: string,
    occurrenceAt: string,
  ) => Promise<DismissResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click and on Escape. A dropdown in a top bar that
  // only closes via its own button traps a keyboard user.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const worst = alerts.some((a) => a.severity === "red") ? "red" : "yellow";
  const count = alerts.length;

  const run = async (key: string, fn: () => Promise<DismissResult>) => {
    setBusy(key);
    setError(null);
    const result = await fn();
    setBusy(null);
    if (result.status === "error") setError(result.message);
    else router.refresh();
  };

  return (
    <div className="relative hidden sm:block" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={
          count === 0
            ? "Notifications — nothing outstanding"
            : `Notifications — ${count} outstanding`
        }
        aria-expanded={open}
        title="Notifications"
        className="relative inline-flex items-center rounded-md p-2 text-muted-foreground hover:bg-foreground/8 hover:text-foreground"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
        </svg>
        {count > 0 && (
          <span
            data-testid="bell-count"
            className={
              "absolute -right-0.5 -top-0.5 min-w-[1rem] rounded-full px-1 text-[0.6rem] font-bold leading-4 text-white " +
              (worst === "red" ? "bg-status-red" : "bg-status-yellow")
            }
          >
            {count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="light absolute right-0 z-50 mt-1 w-[22rem] overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-lg"
        >
          <div className="flex items-baseline justify-between border-b border-border px-3 py-2">
            <p className="text-xs font-semibold">
              {count === 0 ? "Nothing outstanding" : `${count} outstanding`}
            </p>
            <Link
              href="/home"
              onClick={() => setOpen(false)}
              className="text-[0.65rem] text-status-blue hover:underline"
            >
              All alerts
            </Link>
          </div>

          {filterUnavailable && (
            <p className="border-b border-border bg-status-yellow/5 px-3 py-2 text-[0.68rem] text-status-yellow">
              Showing every alert — your dismissals could not be read, so
              this list is unfiltered.
            </p>
          )}

          <ul className="max-h-80 overflow-y-auto">
            {alerts.length === 0 && !filterUnavailable && (
              <li className="px-3 py-4 text-center text-[0.7rem] text-muted-foreground">
                {dismissedCount > 0
                  ? "Everything current has been dismissed."
                  : "No grounded aircraft, overdue flights or expiring MELs."}
              </li>
            )}
            {alerts.map((alert) => (
              <li
                key={alert.id}
                data-testid={`alert-${alert.id}`}
                className="border-b border-border px-3 py-2 last:border-b-0"
              >
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${SEVERITY_DOT[alert.severity]}`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={alert.href}
                      onClick={() => setOpen(false)}
                      className="block text-xs font-semibold hover:text-primary"
                    >
                      {alert.title}
                    </Link>
                    <p className="mt-0.5 text-[0.68rem] text-muted-foreground">
                      {alert.detail}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy === alert.id}
                    onClick={() =>
                      run(alert.id, () =>
                        dismissAction(alert.id, alert.occurredAt),
                      )
                    }
                    aria-label={`Dismiss ${alert.title}`}
                    className="shrink-0 rounded px-1.5 py-0.5 text-[0.65rem] text-muted-foreground hover:bg-muted/40 hover:text-foreground disabled:opacity-50"
                  >
                    {busy === alert.id ? "…" : "Dismiss"}
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {dismissedCount > 0 && (
            <div className="border-t border-border px-3 py-2">
              <p className="text-[0.68rem] text-muted-foreground">
                {dismissedCount} dismissed by you — still true, and
                still on the{" "}
                <Link
                  href="/home"
                  onClick={() => setOpen(false)}
                  className="text-status-blue hover:underline"
                >
                  unfiltered list
                </Link>
                . Dismissing hides an alert from you; it does not
                resolve it.
              </p>
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="border-t border-border px-3 py-2 text-[0.68rem] text-status-red"
            >
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
