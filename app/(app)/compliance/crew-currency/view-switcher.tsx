import Link from "next/link";

/**
 * Tab nav for the three Fleet Compliance views (Spec 5 / M2-G-3).
 *
 * View state lives in the URL `?view=grid|list|calendar` so a Chief
 * Pilot can share a deep link to e.g. the calendar at a specific
 * status filter (`?view=calendar&status=grace_month`).
 *
 *   Grid     — the original matrix (pilots × items, color cells)
 *   List     — flat, sortable rows; quicker to scan when the fleet
 *              grows beyond what fits on-screen as a grid
 *   Calendar — month-by-month plot of base / grace anchors so a CP
 *              can see "what's due in October"
 */

export type ComplianceView = "grid" | "list" | "calendar";

export const COMPLIANCE_VIEWS = ["grid", "list", "calendar"] as const;

export function isComplianceView(v: string | null | undefined): v is ComplianceView {
  return v === "grid" || v === "list" || v === "calendar";
}

const LABELS: Record<ComplianceView, string> = {
  grid: "Grid",
  list: "List",
  calendar: "Calendar",
};

export function ViewSwitcher({
  active,
  statusFilter,
}: {
  active: ComplianceView;
  statusFilter: string | null;
}) {
  return (
    <nav
      aria-label="Compliance view"
      className="mb-3 inline-flex rounded-md border border-border bg-card p-0.5 text-xs"
    >
      {COMPLIANCE_VIEWS.map((view) => {
        const params = new URLSearchParams();
        if (view !== "grid") params.set("view", view);
        if (statusFilter) params.set("status", statusFilter);
        const href =
          "/compliance/crew-currency" +
          (params.toString() ? `?${params.toString()}` : "");
        const isActive = view === active;
        return (
          <Link
            key={view}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={
              "rounded-sm px-3 py-1.5 font-semibold transition-colors " +
              (isActive
                ? "bg-status-blue/15 text-status-blue"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {LABELS[view]}
          </Link>
        );
      })}
    </nav>
  );
}
