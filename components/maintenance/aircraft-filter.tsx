import Link from "next/link";

import type { AircraftListItem } from "@/lib/api/types";

/**
 * "All aircraft" / "tail N…" filter chip row shared by the MEL +
 * Squawks list pages (M2-G-21).
 *
 * URL-driven via `?aircraft=<id>` so the filter is deep-linkable and
 * preserved across the status tabs. Rendered as a horizontal scroll
 * of pill links rather than a <select> so a dispatcher with 5–20
 * aircraft sees the whole fleet at a glance without expanding a
 * dropdown.
 */
export function AircraftFilter({
  basePath,
  aircraft,
  activeAircraftId,
  activeStatus,
}: {
  basePath: string;
  aircraft: AircraftListItem[];
  /** null = "All" pill active. */
  activeAircraftId: string | null;
  activeStatus?: string;
}) {
  if (aircraft.length === 0) return null;

  const buildHref = (id: string | null) => {
    const params = new URLSearchParams();
    if (activeStatus) params.set("status", activeStatus);
    if (id) params.set("aircraft", id);
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Aircraft:
      </span>
      <Pill
        href={buildHref(null)}
        label="All"
        active={activeAircraftId === null}
      />
      {aircraft.map((a) => (
        <Pill
          key={a.id}
          href={buildHref(a.id)}
          label={a.tail_number}
          active={a.id === activeAircraftId}
        />
      ))}
    </div>
  );
}

function Pill({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "rounded-md border border-status-blue bg-status-blue/15 px-2 py-1 font-mono text-[0.65rem] font-semibold text-status-blue"
          : "rounded-md border border-border bg-card px-2 py-1 font-mono text-[0.65rem] font-semibold text-muted-foreground hover:bg-muted/30 hover:text-foreground"
      }
    >
      {label}
    </Link>
  );
}
