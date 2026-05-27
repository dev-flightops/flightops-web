import Link from "next/link";
import { ChevronRight, Plane } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { FlightListItem } from "@/lib/api/types";

import { StatusBadge } from "./status-badge";

export function FlightCard({ flight }: { flight: FlightListItem }) {
  return (
    <Link href={`/dispatch/${flight.id}`} className="block">
      <Card className="cursor-pointer transition-colors hover:bg-accent/40">
        <CardHeader className="space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-xl">{flight.flight_number}</CardTitle>
              <CardDescription className="font-mono text-sm">
                {flight.origin} → {flight.destination}
              </CardDescription>
            </div>
            <StatusBadge status={flight.status} />
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <Field label="Departure" value={formatDate(flight.scheduled_departure_at)} />
          <Field label="Arrival" value={formatDate(flight.scheduled_arrival_at)} />
          <div className="flex items-center justify-between sm:justify-end gap-2">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Plane className="h-4 w-4" />
              <span className="font-mono">{flight.aircraft.tail_number}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
