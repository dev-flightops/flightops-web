import Link from "next/link";
import { ChevronLeft, ChevronRight, Plane } from "lucide-react";

import { StatCard } from "@/components/dashboards/stat-card";
import { StatusBadge } from "@/components/dispatch/status-badge";
import { Button } from "@/components/ui/button";
import { listFlights, getFlightStats } from "@/lib/api/ops";
import { formatDate } from "@/lib/utils";

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function DispatcherDashboardPage() {
  const today = todayUtc();
  const [stats, todaysFlights, releaseQueue] = await Promise.all([
    getFlightStats(),
    listFlights({ onDate: today }),
    listFlights({ status: "scheduled", limit: 10 }),
  ]);

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
          <Plane className="h-5 w-5" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Operations
          </span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Dispatcher</h1>
        <p className="text-sm text-muted-foreground">
          {today} (UTC) · {todaysFlights.total} flight
          {todaysFlights.total === 1 ? "" : "s"} on the board
        </p>
      </header>

      <section className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Scheduled today" value={stats.today.scheduled} />
        <StatCard label="Released today" value={stats.today.released} tone="success" />
        <StatCard
          label="Cancelled today"
          value={stats.today.cancelled}
          tone={stats.today.cancelled > 0 ? "destructive" : "default"}
        />
        <StatCard
          label="Awaiting release"
          value={releaseQueue.total}
          hint={releaseQueue.total > 0 ? "tap a flight to release" : "all clear"}
          tone={releaseQueue.total > 0 ? "warning" : "success"}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card">
          <header className="border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold">Today&apos;s flights</h2>
          </header>
          {todaysFlights.items.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No flights scheduled for {today}.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {todaysFlights.items.map((f) => (
                <li key={f.id}>
                  <Link
                    href={`/dispatch/${f.id}`}
                    className="flex items-center justify-between gap-3 px-6 py-3 transition-colors hover:bg-accent/40"
                  >
                    <div className="space-y-0.5">
                      <p className="font-medium">
                        {f.flight_number}{" "}
                        <span className="font-mono text-muted-foreground">
                          {f.origin} → {f.destination}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(f.scheduled_departure_at)} ·{" "}
                        {f.aircraft.tail_number}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={f.status} />
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card">
          <header className="border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold">Release queue</h2>
            <p className="text-xs text-muted-foreground">
              All scheduled flights — across dates — awaiting release
            </p>
          </header>
          {releaseQueue.items.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No flights awaiting release.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {releaseQueue.items.map((f) => (
                <li key={f.id}>
                  <Link
                    href={`/dispatch/${f.id}`}
                    className="flex items-center justify-between gap-3 px-6 py-3 transition-colors hover:bg-accent/40"
                  >
                    <div className="space-y-0.5">
                      <p className="font-medium">
                        {f.flight_number}{" "}
                        <span className="font-mono text-muted-foreground">
                          {f.origin} → {f.destination}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(f.scheduled_departure_at)}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
