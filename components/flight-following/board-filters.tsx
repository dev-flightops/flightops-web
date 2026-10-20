"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { segment, segmentGroup } from "@/components/ff/controls";
import type { FlightStatus } from "@/lib/api/types";

/**
 * URL-driven filter bar above the flight board per the Flight
 * Following spec, "Filters and search":
 *
 *   - Search field — flight#, tail, PIC, ICAO codes; real-time
 *   - Status multi-select — subset of FlightStatus
 *   - Base filter — single ICAO from the routes currently in scope
 *
 * State lives in the URL (?q=, ?statuses=, ?base=) so dispatchers can
 * share / bookmark / survive refresh. The page's server component
 * applies the filters against the board data before rendering.
 *
 * Spec-listed but not here yet: date selector (we have day-window
 * tabs upstream) and the multi-select "All" pseudo-option.
 */
export function BoardFilters({
  bases,
  q,
  statuses,
  base,
}: {
  bases: string[];
  q: string;
  statuses: FlightStatus[];
  base: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params?.toString() ?? "");
    if (value === null || value === "") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    const qs = next.toString();
    startTransition(() => {
      router.replace(`/flight-following${qs ? `?${qs}` : ""}`, {
        scroll: false,
      });
    });
  };

  const toggleStatus = (status: FlightStatus) => {
    const set = new Set(statuses);
    if (set.has(status)) set.delete(status);
    else set.add(status);
    updateParam(
      "statuses",
      set.size === 0 ? null : [...set].sort().join(","),
    );
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <input
        type="search"
        defaultValue={q}
        placeholder="Search flight #, tail, PIC, ICAO…"
        aria-label="Search flights"
        onChange={(e) => updateParam("q", e.target.value)}
        className="ff-input min-w-[220px] flex-1"
      />

      <div
        role="group"
        aria-label="Status filter"
        className={segmentGroup}
      >
        {(
          [
            { value: "scheduled", label: "Planned" },
            { value: "released", label: "Released" },
            { value: "completed", label: "Completed" },
            { value: "cancelled", label: "Cancelled" },
          ] satisfies { value: FlightStatus; label: string }[]
        ).map((s) => {
          const on = statuses.includes(s.value);
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => toggleStatus(s.value)}
              aria-pressed={on}
              className={segment(on)}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <select
        value={base}
        onChange={(e) => updateParam("base", e.target.value)}
        aria-label="Base filter"
        className="ff-input w-auto"
      >
        <option value="">All bases</option>
        {bases.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>

      {(q || statuses.length > 0 || base) && (
        <button
          type="button"
          onClick={() => {
            const next = new URLSearchParams(params?.toString() ?? "");
            next.delete("q");
            next.delete("statuses");
            next.delete("base");
            const qs = next.toString();
            startTransition(() => {
              router.replace(
                `/flight-following${qs ? `?${qs}` : ""}`,
                { scroll: false },
              );
            });
          }}
          className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-status-red hover:underline underline-offset-4"
        >
          Clear
        </button>
      )}
    </div>
  );
}
