import Link from "next/link";
import { ChevronLeft, MapPin } from "lucide-react";

import { StatCard } from "@/components/dashboards/stat-card";
import { Button } from "@/components/ui/button";
import { listFlights } from "@/lib/api/ops";
import type { FlightListItem } from "@/lib/api/types";

interface StationCounts {
  station: string;
  departures: number;
  arrivals: number;
  total: number;
}

function aggregate(flights: FlightListItem[]): StationCounts[] {
  const byStation = new Map<string, { departures: number; arrivals: number }>();
  for (const f of flights) {
    const dep = byStation.get(f.origin) ?? { departures: 0, arrivals: 0 };
    dep.departures += 1;
    byStation.set(f.origin, dep);

    const arr = byStation.get(f.destination) ?? { departures: 0, arrivals: 0 };
    arr.arrivals += 1;
    byStation.set(f.destination, arr);
  }
  return Array.from(byStation.entries())
    .map(([station, c]) => ({
      station,
      departures: c.departures,
      arrivals: c.arrivals,
      total: c.departures + c.arrivals,
    }))
    .sort((a, b) => b.total - a.total);
}

export default async function StationDashboardPage() {
  // Pull a wide window so we have meaningful counts (max 200 per call)
  const { items: flights } = await listFlights({ limit: 200 });
  const stations = aggregate(flights);
  const totalMovements = stations.reduce((sum, s) => sum + s.total, 0);

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
          <MapPin className="h-5 w-5" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Insights
          </span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Station</h1>
        <p className="text-sm text-muted-foreground">
          Traffic by airport across the {flights.length} most recent flight
          {flights.length === 1 ? "" : "s"} (most recent first).
        </p>
      </header>

      <section className="mb-8 grid gap-3 sm:grid-cols-3">
        <StatCard label="Active stations" value={stations.length} />
        <StatCard label="Total movements" value={totalMovements} />
        <StatCard
          label="Busiest station"
          value={stations[0]?.station ?? "—"}
          hint={stations[0] ? `${stations[0].total} movements` : undefined}
        />
      </section>

      <section className="rounded-lg border border-border bg-card">
        <header className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold">Per-station traffic</h2>
        </header>
        {stations.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">
            No flights logged yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left">
                <Th>Station</Th>
                <Th className="text-right">Departures</Th>
                <Th className="text-right">Arrivals</Th>
                <Th className="text-right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {stations.map((s) => (
                <tr key={s.station} className="border-b border-border/40 last:border-0">
                  <Td className="font-mono font-medium">{s.station}</Td>
                  <Td className="text-right tabular-nums">{s.departures}</Td>
                  <Td className="text-right tabular-nums">{s.arrivals}</Td>
                  <Td className="text-right font-semibold tabular-nums">{s.total}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p className="mt-4 text-xs text-muted-foreground">
        Fuel and ground-time metrics land with the ground-service in Month 2.
      </p>
    </main>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-6 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground ${className ?? ""}`}
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-6 py-3 ${className ?? ""}`}>{children}</td>;
}
