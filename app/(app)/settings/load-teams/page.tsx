import Link from "next/link";

/**
 * /settings/load-teams — legacy `templates/settings/load_teams.html`.
 *
 * Ramp/load crew teams grouped by base. Header + Fleet Report link +
 * Add Team + Show Inactive toggle. Three-tab layout: Teams (default)
 * · Reminders · Activity Log. Team cards show colour swatch, lead
 * (green) or "No Lead Assigned" (yellow), member count, notes, and
 * per-card actions (Edit, Members, Performance, Deactivate/Reactivate).
 *
 * Backend not shipped — Marc's M2 ground-service Load Teams endpoints
 * (teams + team_members + assignments) still to land. All CTAs
 * disabled with milestone tooltips.
 */

const BACKEND_HINT =
  "Load Teams ships with the ground-service backend (M2)";

export default function SettingsLoadTeamsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <nav aria-label="Breadcrumb" className="mb-4 text-xs">
        <Link href="/settings" className="text-muted-foreground hover:text-foreground">
          Settings
        </Link>
        <span aria-hidden className="px-1.5 text-muted-foreground">/</span>
        <span className="font-semibold text-status-blue">Load Teams</span>
      </nav>

      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Load Teams</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Manage ramp and load crew teams by base
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled
            aria-disabled="true"
            title={BACKEND_HINT}
            className="cursor-not-allowed rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground disabled:opacity-100"
          >
            Fleet Report
          </button>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title={BACKEND_HINT}
            className="cursor-not-allowed rounded-md bg-status-blue px-3 py-2 text-sm font-semibold text-white disabled:opacity-100"
          >
            + Add Team
          </button>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title={BACKEND_HINT}
            className="cursor-not-allowed rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground disabled:opacity-100"
          >
            Show Inactive
          </button>
        </div>
      </header>

      <div className="mb-4 flex gap-1 border-b-2 border-border">
        <TabChip label="Teams" active />
        <TabChip label="Reminders" />
        <TabChip label="Activity Log" />
      </div>

      <div className="rounded-lg border border-border bg-card px-6 py-10 text-center">
        <div className="mx-auto mb-2 text-2xl opacity-30">👥</div>
        <p className="text-sm text-muted-foreground">
          No load teams created yet.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Teams appear here once the ground-service ships the M2 backend. Each
          team lives under a base with a color swatch, lead assignment, member
          list, and per-team performance report.
        </p>
      </div>
    </div>
  );
}

function TabChip({ label, active }: { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      aria-pressed={active}
      title="Load Teams tabs ship with the ground-service backend (M2)"
      className={
        "cursor-not-allowed px-4 py-2 text-xs font-semibold disabled:opacity-100 " +
        (active
          ? "border-b-2 border-status-blue text-status-blue"
          : "border-b-2 border-transparent text-muted-foreground")
      }
      style={active ? { marginBottom: "-2px" } : { marginBottom: "-2px" }}
    >
      {label}
    </button>
  );
}
