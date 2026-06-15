"use client";

import { useRouter } from "next/navigation";

import type { CompanyBaseResponse } from "@/lib/api/types";

/**
 * Base filter dropdown for /ramp-ops. Auto-navigates on change with the
 * `base` query param so the server page is the source of truth — the
 * server filters the flight list + load teams using whatever's in the URL.
 *
 * Kept tiny so the rest of /ramp-ops stays a server component.
 */
export function BaseFilter({
  bases,
  active,
}: {
  bases: CompanyBaseResponse[];
  active: string | null;
}) {
  const router = useRouter();

  if (bases.length === 0) {
    return (
      <span className="rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground">
        All Bases
      </span>
    );
  }

  return (
    <select
      value={active ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        const qs = v ? `?base=${encodeURIComponent(v)}` : "";
        router.push(`/ramp-ops${qs}`);
      }}
      aria-label="Filter flights by base"
      className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground focus:border-status-blue focus:outline-none"
    >
      <option value="">All Bases</option>
      {bases.map((b) => (
        <option key={b.id} value={b.icao}>
          {b.icao} — {b.display_name}
        </option>
      ))}
    </select>
  );
}
