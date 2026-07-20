"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Fleet-board chrome — title, view toggle, per-day navigator, metrics
 * badges, search + filter chips. Split out as a client component so
 * the date/view controls can push URL params without a full form
 * submit.
 *
 * Filter chips (Bases / Types / Pilots) render but don't filter yet —
 * bookings don't carry those FKs today. When the base/type/pilot
 * fields land on the booking schema, wire the chips to querystring
 * params + backend filters. Matches legacy visually.
 */
export function FleetBoardChrome({
  view,
  day,
  isoDay,
  flightsCount,
  bookedSeats,
  totalSeats,
}: {
  view: "list" | "board" | "split";
  day: Date;
  isoDay: string;
  flightsCount: number;
  bookedSeats: number;
  totalSeats: number;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  function pushDay(d: Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const params = new URLSearchParams({ d: iso });
    if (view !== "board") params.set("view", view);
    router.push(`/reservations/fleet-board?${params.toString()}`);
  }

  function todayLabel(): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dNorm = new Date(day);
    dNorm.setHours(0, 0, 0, 0);
    const diff = Math.round(
      (dNorm.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
    );
    const dayName = day.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    if (diff === 0) return `Today — ${dayName}`;
    if (diff === 1) return `Tomorrow — ${dayName}`;
    if (diff === -1) return `Yesterday — ${dayName}`;
    return dayName;
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Fleet Board</h1>
          <div className="flex overflow-hidden rounded-md border border-border">
            {(["list", "board", "split"] as const).map((v) => {
              const params = new URLSearchParams({ d: isoDay });
              if (v !== "board") params.set("view", v);
              return (
                <Link
                  key={v}
                  href={`/reservations/fleet-board?${params.toString()}`}
                  aria-current={view === v ? "page" : undefined}
                  className={
                    "px-2.5 py-1 text-xs font-semibold transition " +
                    (view === v
                      ? "bg-status-blue/15 text-status-blue"
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
            onClick={() => {
              const d = new Date(day);
              d.setDate(d.getDate() - 1);
              pushDay(d);
            }}
            className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            aria-label="Previous day"
          >
            ←
          </button>
          <div className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-status-green">
            {todayLabel()}
          </div>
          <button
            type="button"
            onClick={() => {
              const d = new Date(day);
              d.setDate(d.getDate() + 1);
              pushDay(d);
            }}
            className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            aria-label="Next day"
          >
            →
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-md border border-status-blue/40 bg-status-blue/10 px-2.5 py-1 text-xs font-semibold text-status-blue">
            {flightsCount} flight{flightsCount === 1 ? "" : "s"}
          </span>
          <span className="rounded-md border border-status-green/40 bg-status-green/10 px-2.5 py-1 text-xs font-semibold text-status-green">
            {bookedSeats}/{totalSeats} seats
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[16rem]">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60">
            🔍
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search passenger, flight, ref…"
            className="w-full rounded-md border border-border bg-background pl-8 pr-3 py-1.5 text-xs outline-none focus:border-primary"
          />
        </div>

        {/* Filter chips — placeholder for now. Legacy has these driven by
            bookings.base_id / aircraft.aircraft_type / bookings.pilot_id
            (fields we haven't added yet). Render as no-op dropdowns to
            match the UI; wire when the fields exist. */}
        <FilterChip label="All Bases" />
        <FilterChip label="All Types" />
        <FilterChip label="All Pilots" />
        <button
          type="button"
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-muted/20"
        >
          Go
        </button>
      </div>
    </>
  );
}

function FilterChip({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      title="Filter fields ship with the base/type/pilot booking assignment story (M3 follow-up)"
      className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-semibold text-muted-foreground/70 cursor-not-allowed"
    >
      {label}
    </button>
  );
}
