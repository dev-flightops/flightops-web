"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  describeIsoDay,
  shiftIsoDay,
} from "@/lib/iso-day";
import { SearchGlyph } from "@/components/ff/glyphs";

/**
 * Fleet-board chrome — title, view toggle, per-day navigator, metrics
 * badges and booking search. Split out as a client component so
 * the date/view controls can push URL params without a full form
 * submit.
 *
 */
export function FleetBoardChrome({
  view,
  isoDay,
  today,
  searchQuery = "",
  flightsCount,
  bookedSeats,
  totalSeats,
  unassignedPax = 0,
}: {
  view: "list" | "board" | "split";
  isoDay: string;
  today: string;
  searchQuery?: string;
  flightsCount: number;
  bookedSeats: number;
  totalSeats: number;
  unassignedPax?: number;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(searchQuery);

  // The day is taken from the URL string, never from a Date handed down by
  // the server: those disagree by a day for any viewer west of Greenwich,
  // which used to make the → arrow push the URL it was already on. See
  // lib/iso-day.ts.
  function pushDay(iso: string) {
    const params = new URLSearchParams({ d: iso });
    if (view !== "board") params.set("view", view);
    if (searchQuery) params.set("q", searchQuery);
    router.push(`/reservations/fleet-board?${params.toString()}`);
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Fleet Board</h1>
          <div className="flex overflow-hidden rounded-md border border-border">
            {(["list", "board", "split"] as const).map((v) => {
              const params = new URLSearchParams({ d: isoDay });
              if (v !== "board") params.set("view", v);
              if (searchQuery) params.set("q", searchQuery);
              return (
                <Link
                  key={v}
                  href={`/reservations/fleet-board?${params.toString()}`}
                  aria-current={view === v ? "page" : undefined}
                  className={
                    "px-2.5 py-1 text-xs font-semibold transition " +
                    (view === v
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => pushDay(shiftIsoDay(isoDay, -1))}
            className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            aria-label="Previous day"
          >
            ←
          </button>
          <div className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-status-green">
            {describeIsoDay(isoDay, today)}
          </div>
          <button
            type="button"
            onClick={() => pushDay(shiftIsoDay(isoDay, 1))}
            className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            aria-label="Next day"
          >
            →
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="status-mark text-muted-foreground">
            {/* Bookings, which is what this board shows (#157: "Header
                '3 flights' while 7 on the board today"). */}
            {flightsCount} booking{flightsCount === 1 ? "" : "s"}
          </span>
          <span className="status-mark text-status-green">
            {bookedSeats}/{totalSeats} assigned seats
          </span>
          {unassignedPax > 0 ? <span className="status-mark text-status-yellow">{unassignedPax} passenger{unassignedPax === 1 ? "" : "s"} awaiting a flight</span> : null}
        </div>
      </div>

      <form method="get" action="/reservations/fleet-board" role="search" className="mt-4 flex flex-wrap items-center gap-2">
        <input type="hidden" name="d" value={isoDay} />
        <input type="hidden" name="view" value={view} />
        <div className="relative flex-1 min-w-[16rem]">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
            <SearchGlyph size={14} />
          </span>
          <input
            type="search"
            name="q"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search passenger, flight, ref…"
            className="ff-input pl-8 pr-3 py-1.5 text-xs"
          />
        </div>

        <button
          type="submit"
          className="btn-caps rounded-md border border-input px-3 py-1.5 text-foreground hover:bg-accent text-[0.72rem]"
        >
          Go
        </button>
      </form>
    </>
  );
}
