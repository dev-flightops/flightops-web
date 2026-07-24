import Link from "next/link";

/**
 * /reservations/charter — legacy `templates/charter/board.html`.
 * Charter Pipeline — status-tabbed list of CharterRequest rows
 * (separate from Booking in legacy dispatch-platform).
 *
 * The CharterRequest table + its 6-status state machine
 * (request → quoted → confirmed → dispatched → completed → invoiced,
 * or → cancelled at any point) aren't ported yet. Marc's M3
 * reservations-service extension owns this. The page renders the
 * legacy shell (title + New Charter Request + status tabs + empty
 * state) so the URL is correct + the layout is ready to wire when
 * the endpoints land.
 */

const STATUS_TABS = [
  { id: "all", label: "All" },
  { id: "request", label: "Request" },
  { id: "quoted", label: "Quoted" },
  { id: "confirmed", label: "Confirmed" },
  { id: "dispatched", label: "Dispatched" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
] as const;

const BACKEND_HINT =
  "Charter Pipeline ships with the reservations-service charter_requests table (M3 tail)";

type StatusId = (typeof STATUS_TABS)[number]["id"];

function parseStatus(v: string | string[] | undefined): StatusId {
  const s = Array.isArray(v) ? v[0] : v;
  if (
    s === "request" ||
    s === "quoted" ||
    s === "confirmed" ||
    s === "dispatched" ||
    s === "completed" ||
    s === "cancelled"
  ) {
    return s;
  }
  return "all";
}

export default async function CharterPipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const params = await searchParams;
  const active = parseStatus(params.status);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Charter Pipeline</h1>
        <button
          type="button"
          disabled
          aria-disabled="true"
          title={BACKEND_HINT}
          className="cursor-not-allowed rounded-md bg-status-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-100"
        >
          + New Charter Request
        </button>
      </header>

      <div className="mb-5 flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => {
          const isActive = t.id === active;
          const href =
            t.id === "all"
              ? "/reservations/charter"
              : `/reservations/charter?status=${t.id}`;
          return (
            <Link
              key={t.id}
              href={href}
              className={
                "rounded-lg border border-border px-3 py-1.5 text-xs " +
                (isActive
                  ? "bg-muted/40 font-bold text-foreground"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <div className="rounded-lg border border-border bg-card">
        <p className="py-8 text-center text-sm text-muted-foreground">
          No charter requests found.
        </p>
      </div>
    </div>
  );
}
