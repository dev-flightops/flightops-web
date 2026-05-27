import Link from "next/link";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
} from "lucide-react";

import { StatCard } from "@/components/dashboards/stat-card";
import { StatusBadge } from "@/components/dispatch/status-badge";
import { Button } from "@/components/ui/button";
import { listFlights } from "@/lib/api/ops";
import { formatDate } from "@/lib/utils";
import type { FlightListItem } from "@/lib/api/types";

function daysFromToday(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default async function DirectorOpsDashboardPage() {
  // Pull next 7 days of flights in parallel
  const days = Array.from({ length: 7 }, (_, i) => daysFromToday(i));
  const perDay = await Promise.all(
    days.map((d) => listFlights({ onDate: d, limit: 50 })),
  );

  const totalNext7 = perDay.reduce((sum, r) => sum + r.total, 0);
  const allFlights = perDay.flatMap((r) => r.items);
  const exceptions = allFlights.filter(
    (f) => f.status === "cancelled",
  );

  return (
    <main className="container py-10">
      <Link href="/dashboards" className="inline-block">
        <Button variant="ghost" size="sm" className="mb-4 -ml-3">
          <ChevronLeft className="h-4 w-4" />
          Dashboards
        </Button>
      </Link>

      <header className="mb-8 space-y-1">
        <div className="flex items-center gap-2 text-primary">
          <LayoutDashboard className="h-5 w-5" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Insights
          </span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Director of Operations
        </h1>
        <p className="text-sm text-muted-foreground">
          Next 7 days plan + exception list (UTC).
        </p>
      </header>

      <section className="mb-8 grid gap-3 sm:grid-cols-3">
        <StatCard label="Flights in next 7 days" value={totalNext7} />
        <StatCard
          label="Exceptions"
          value={exceptions.length}
          hint={exceptions.length > 0 ? "needs review" : "clear"}
          tone={exceptions.length > 0 ? "destructive" : "success"}
        />
        <StatCard
          label="Today"
          value={perDay[0].total}
          hint={`${perDay[0].items.filter((f) => f.status === "released").length} released`}
        />
      </section>

      <section className="mb-8 rounded-lg border border-border bg-card">
        <header className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold">7-day plan</h2>
        </header>
        <div className="divide-y divide-border">
          {days.map((d, i) => {
            const dayFlights = perDay[i].items;
            return (
              <div key={d} className="px-6 py-4">
                <div className="mb-2 flex items-baseline justify-between">
                  <h3 className="font-medium">
                    {d}
                    {i === 0 && (
                      <span className="ml-2 text-xs uppercase tracking-wide text-muted-foreground">
                        today
                      </span>
                    )}
                  </h3>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {dayFlights.length} flight
                    {dayFlights.length === 1 ? "" : "s"}
                  </span>
                </div>
                {dayFlights.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No flights scheduled.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {dayFlights.map((f) => (
                      <FlightRow key={f.id} flight={f} />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card">
        <header className="flex items-center gap-2 border-b border-border px-6 py-4">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <h2 className="text-lg font-semibold">Exceptions</h2>
          <span className="ml-auto text-xs text-muted-foreground">
            cancelled flights in the next 7 days
          </span>
        </header>
        {exceptions.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">
            No exceptions. All flights are scheduled or released.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {exceptions.map((f) => (
              <li key={f.id}>
                <FlightLinkRow flight={f} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function FlightRow({ flight }: { flight: FlightListItem }) {
  return (
    <li className="flex items-center justify-between text-sm">
      <span>
        <span className="font-medium">{flight.flight_number}</span>{" "}
        <span className="font-mono text-muted-foreground">
          {flight.origin} → {flight.destination}
        </span>{" "}
        <span className="text-muted-foreground">
          · {formatDate(flight.scheduled_departure_at, { timeStyle: "short" })}
        </span>
      </span>
      <StatusBadge status={flight.status} />
    </li>
  );
}

function FlightLinkRow({ flight }: { flight: FlightListItem }) {
  return (
    <Link
      href={`/dispatch/${flight.id}`}
      className="flex items-center justify-between gap-3 px-6 py-3 transition-colors hover:bg-accent/40"
    >
      <div className="space-y-0.5">
        <p className="font-medium">
          {flight.flight_number}{" "}
          <span className="font-mono text-muted-foreground">
            {flight.origin} → {flight.destination}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDate(flight.scheduled_departure_at)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={flight.status} />
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </Link>
  );
}
