import { ApiError } from "@/lib/api/client";
import {
  getTypeQualificationGrid,
  type TypeQualificationGrid,
} from "@/lib/api/type-qualifications";

import { QualificationGrid, QualificationLegend } from "./qualification-grid";

/**
 * /compliance/type-qualifications — who may fly each aircraft type, and
 * in which position (#45, M4-A-1).
 *
 * Legacy listed a pilot's aircraft qualifications only on the crew
 * record; the operator's 135ACM keeps them as one grid across the
 * company, which is what a chief pilot reads before rostering. Changes
 * are made on each pilot's compliance page.
 *
 * The base filter is applied here rather than by the service so the
 * chips can always offer every base, including after one is picked.
 */

export const dynamic = "force-dynamic";

export default async function TypeQualificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ station?: string }>;
}) {
  const { station } = await searchParams;
  const code = station?.trim().toUpperCase() || null;

  let grid: TypeQualificationGrid | null = null;
  let loadError: string | null = null;
  try {
    grid = await getTypeQualificationGrid();
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Aircraft qualifications are unavailable. Try refreshing in a moment.";
  }

  const pilots = grid?.pilots ?? [];
  const stations = Array.from(
    new Set(pilots.map((p) => p.station).filter((s): s is string => Boolean(s))),
  ).sort();
  const shown = code ? pilots.filter((p) => p.station === code) : pilots;
  const lapsed = shown.reduce(
    (n, p) => n + p.cells.filter((c) => c.state === "non_current").length,
    0,
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Aircraft Qualifications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The positions each pilot is authorised to fly, by aircraft type. A
          position is current while the check rides on its type are in date.
        </p>
        {grid ? (
          <p className="mt-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">
              Release check: {grid.enforced ? "on" : "off"}.
            </span>{" "}
            {grid.enforced
              ? "Release is refused for a PIC not current as PIC on the aircraft's type, unless a supervisor overrides it."
              : "Release doesn't check these yet. The Director of Operations or an Exec Admin turns it on in Settings → Currency."}
          </p>
        ) : null}
      </header>

      {loadError ? (
        <p
          role="alert"
          className="rounded-lg border border-status-red/40 bg-status-red/10 px-4 py-3 text-sm text-status-red"
        >
          {loadError}
        </p>
      ) : (
        <>
          {lapsed > 0 ? (
            <p
              role="status"
              className="mb-4 rounded-lg border border-status-red/40 bg-status-red/10 px-4 py-2.5 text-sm text-status-red"
            >
              <strong className="font-semibold">
                {lapsed} authorised position{lapsed === 1 ? " is" : "s are"} not
                current.
              </strong>{" "}
              A check ride on the type is overdue or not on file.
            </p>
          ) : null}

          {stations.length > 1 ? (
            <nav
              aria-label="Filter by base"
              className="mb-4 flex flex-wrap items-center gap-1.5 text-xs"
            >
              <FilterChip href="/compliance/type-qualifications" active={!code}>
                All bases
              </FilterChip>
              {stations.map((s) => (
                <FilterChip
                  key={s}
                  href={`/compliance/type-qualifications?station=${encodeURIComponent(s)}`}
                  active={code === s}
                >
                  {s}
                </FilterChip>
              ))}
            </nav>
          ) : null}

          <QualificationGrid airframeTypes={grid?.airframe_types ?? []} pilots={shown} />
          <QualificationLegend />
        </>
      )}
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        "rounded-md border px-2.5 py-1 font-semibold transition " +
        (active
          ? "border-primary/50 bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </a>
  );
}
