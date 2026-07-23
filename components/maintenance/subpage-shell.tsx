import { type ReactNode } from "react";

/**
 * Shared shell for Maintenance sub-pages that don't have backends yet
 * (Work Orders, RTS, Inventory, MX Clock, Availability, Batch Trace,
 * Expiration). Marc's maintenance-service currently exposes MEL,
 * squawks, and airworthiness — the shells will swap to real data as
 * each backend lands.
 *
 * Renders a heading + subtitle, an optional right-aligned CTA cluster
 * (all disabled + tooltip-hinted), and an empty-state panel. The
 * Maintenance sub-nav auto-renders via DepartmentNav since these
 * routes sit under /maintenance which is in the "maintenance" dept's
 * pathPrefixes.
 */
export interface MaintenanceShellProps {
  title: string;
  subtitle?: string;
  ctas?: Array<{ label: string; primary?: boolean }>;
  emptyText: string;
  /** Short reason for the disabled CTAs — passed through as the
   * hover tooltip. Kept short so it reads well on hover. */
  backendHint?: string;
  /** Optional children — for pages that eventually want more than an
   * empty state. Rendered in place of the empty state when present. */
  children?: ReactNode;
}

export function MaintenanceShell({
  title,
  subtitle,
  ctas = [],
  emptyText,
  backendHint = "Ships with the maintenance-service (M3 backend)",
  children,
}: MaintenanceShellProps) {
  return (
    <div className="w-full px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {ctas.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {ctas.map((cta) => (
              <button
                key={cta.label}
                type="button"
                disabled
                aria-disabled="true"
                title={backendHint}
                className={
                  "cursor-not-allowed rounded-md px-3 py-2 text-xs font-semibold disabled:opacity-100 " +
                  (cta.primary
                    ? "bg-status-blue text-white"
                    : "border border-border bg-card text-foreground")
                }
              >
                {cta.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {children ?? (
        <div className="rounded-lg border border-border bg-card px-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        </div>
      )}
    </div>
  );
}
