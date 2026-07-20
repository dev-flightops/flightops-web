/**
 * /housing — Housing Management.
 *
 * Matches legacy peregrineflight.com/housing/ shell:
 *   Header: "Housing Management" + "N houses · N rooms · N available
 *   · N occupied"  |  Assignments · Maintenance · Reports · + New
 *   House · AI Assistant
 *   Calendar sub-nav: ← Month · ← Week · Today · Week → · Month →
 *   Tag legend row: Pilots · Mechanics · Dispatch · Management ·
 *   Training · VIP · + Tag       right hint: "Drag a tag across room
 *   cells to book. Release to open the booking form."
 *   Empty: "No housing units available. Create a house to get started."
 *
 * There is no housing-service yet — Marc's HR/Housing M3 backend
 * story owns the calendar grid + tag/booking model. This page renders
 * the shell so the home tile can go live and the layout is ready to
 * wire up when the API lands. All action buttons render disabled with
 * milestone tooltips.
 */

const HOUSING_BACKEND_HINT =
  "Housing bookings ship with the housing-service (M3 backend)";

const TAG_COLORS = [
  { id: "pilots", label: "Pilots", color: "blue" },
  { id: "mechanics", label: "Mechanics", color: "green" },
  { id: "dispatch", label: "Dispatch", color: "orange" },
  { id: "management", label: "Management", color: "purple" },
  { id: "training", label: "Training", color: "teal" },
  { id: "vip", label: "VIP", color: "yellow" },
] as const;

export default function HousingPage() {
  const stats = { houses: 0, rooms: 0, available: 0, occupied: 0 };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Housing Management</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {stats.houses} houses · {stats.rooms} rooms ·{" "}
            <span className="text-status-green">
              {stats.available} available
            </span>{" "}
            ·{" "}
            <span className="text-status-yellow">
              {stats.occupied} occupied
            </span>
          </p>
        </div>
        <HeaderActions />
      </header>

      <CalendarNav />
      <TagLegend />
      <EmptyState />
    </div>
  );
}

function HeaderActions() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {(["Assignments", "Maintenance", "Reports"] as const).map((label) => (
        <button
          key={label}
          type="button"
          disabled
          aria-disabled="true"
          title={HOUSING_BACKEND_HINT}
          className="cursor-not-allowed rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground/70 opacity-70"
        >
          {label}
        </button>
      ))}
      <button
        type="button"
        disabled
        aria-disabled="true"
        title={HOUSING_BACKEND_HINT}
        className="cursor-not-allowed rounded-md bg-status-blue px-3 py-2 text-xs font-semibold text-white opacity-70"
      >
        + New House
      </button>
      <button
        type="button"
        disabled
        aria-disabled="true"
        title="AI Assistant · Coming in M4"
        className="cursor-not-allowed rounded-md border border-status-purple/40 bg-status-purple/15 px-3 py-2 text-xs font-semibold text-status-purple opacity-80"
      >
        ✨ AI Assistant
      </button>
    </div>
  );
}

function CalendarNav() {
  return (
    <nav
      aria-label="Calendar navigation"
      className="mb-3 flex flex-wrap items-center gap-2"
    >
      {(
        [
          { label: "← Month", key: "prev-month" },
          { label: "← Week", key: "prev-week" },
          { label: "Today", key: "today", active: true },
          { label: "Week →", key: "next-week" },
          { label: "Month →", key: "next-month" },
        ] as const
      ).map((btn) => (
        <button
          key={btn.key}
          type="button"
          disabled
          aria-disabled="true"
          aria-pressed={"active" in btn ? btn.active : undefined}
          title={HOUSING_BACKEND_HINT}
          className={
            "cursor-not-allowed rounded-md px-3 py-1.5 text-xs font-semibold opacity-80 " +
            ("active" in btn && btn.active
              ? "bg-status-blue text-white"
              : "border border-border bg-card text-foreground/70")
          }
        >
          {btn.label}
        </button>
      ))}
    </nav>
  );
}

const _TAG_COLOR_MAP: Record<
  (typeof TAG_COLORS)[number]["color"],
  string
> = {
  blue: "border-status-blue/40 bg-status-blue/15 text-status-blue",
  green: "border-status-green/40 bg-status-green/15 text-status-green",
  orange: "border-status-orange/40 bg-status-orange/15 text-status-orange",
  purple: "border-status-purple/40 bg-status-purple/15 text-status-purple",
  teal: "border-status-teal/40 bg-status-teal/15 text-status-teal",
  yellow: "border-status-yellow/40 bg-status-yellow/15 text-status-yellow",
};

function TagLegend() {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
      <span className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Tags:
      </span>
      <ul className="flex flex-wrap items-center gap-2">
        {TAG_COLORS.map((t) => (
          <li key={t.id}>
            <span
              className={
                "rounded-md border px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wider " +
                _TAG_COLOR_MAP[t.color]
              }
            >
              {t.label}
            </span>
          </li>
        ))}
        <li>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title={HOUSING_BACKEND_HINT}
            className="cursor-not-allowed rounded-md border border-dashed border-border px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-status-blue opacity-70"
          >
            + Tag
          </button>
        </li>
      </ul>
      <p className="ml-auto text-[0.7rem] text-muted-foreground">
        Drag a tag across room cells to book. Release to open the booking form.
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-16 text-center">
      <p className="text-sm text-muted-foreground">
        No housing units available. Create a house to get started.
      </p>
    </div>
  );
}
