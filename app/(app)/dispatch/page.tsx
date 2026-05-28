import { Plane } from "lucide-react";

import { Card } from "@/components/ui/card";
import { FlightTable } from "@/components/dispatch/flight-table";
import { listFlights } from "@/lib/api/ops";

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function DispatchPage() {
  const today = todayUtc();
  const { items, total } = await listFlights({ onDate: today });

  return (
    <div className="container py-6">
      <header className="mb-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Plane className="h-3.5 w-3.5" />
          <span className="text-[0.65rem] font-bold uppercase tracking-[0.08em]">
            Operations · Dispatch
          </span>
        </div>
        <h1 className="mt-1 text-xl font-bold tracking-tight">
          Flight Dispatch
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {total} flight{total === 1 ? "" : "s"} scheduled for{" "}
          <span className="font-mono">{today}</span> (UTC)
        </p>
      </header>

      {items.length === 0 ? (
        <EmptyState date={today} />
      ) : (
        <Card className="p-0 overflow-hidden">
          <FlightTable flights={items} />
        </Card>
      )}
    </div>
  );
}

function EmptyState({ date }: { date: string }) {
  return (
    <Card className="border-dashed bg-muted/20 p-12 text-center">
      <Plane className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-3 text-sm text-muted-foreground">
        No flights scheduled for <span className="font-mono">{date}</span>.
      </p>
    </Card>
  );
}
