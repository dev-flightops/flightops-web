import Link from "next/link";
import { ChevronLeft, Plane } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FlightCard } from "@/components/dispatch/flight-card";
import { listFlights } from "@/lib/api/ops";

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function DispatchPage() {
  const today = todayUtc();
  const { items, total } = await listFlights({ onDate: today });

  return (
    <main className="container py-10">
      <Link href="/" className="inline-block">
        <Button variant="ghost" size="sm" className="mb-4 -ml-3">
          <ChevronLeft className="h-4 w-4" />
          Home
        </Button>
      </Link>

      <header className="mb-8 flex items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary">
            <Plane className="h-5 w-5" />
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Operations
            </span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Dispatch</h1>
          <p className="text-sm text-muted-foreground">
            {total} flight{total === 1 ? "" : "s"} scheduled for {today} (UTC)
          </p>
        </div>
      </header>

      {items.length === 0 ? (
        <EmptyState date={today} />
      ) : (
        <div className="grid gap-3">
          {items.map((flight) => (
            <FlightCard key={flight.id} flight={flight} />
          ))}
        </div>
      )}
    </main>
  );
}

function EmptyState({ date }: { date: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20 p-12 text-center">
      <Plane className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-3 text-sm text-muted-foreground">
        No flights scheduled for {date}.
      </p>
    </div>
  );
}
