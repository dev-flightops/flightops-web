import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/data-table";
import { formatDate } from "@/lib/utils";
import type { FlightListItem } from "@/lib/api/types";

import { StatusBadge } from "./status-badge";

interface FlightTableProps {
  flights: FlightListItem[];
}

/**
 * Dense flight list — replaces the previous FlightCard grid on the dispatch
 * page. Matches the legacy dispatcher dashboard's flight board: mono codes
 * (flight #, route, tail, times) with a status badge and a right-arrow link.
 */
export function FlightTable({ flights }: FlightTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-[110px]">Flight</TableHead>
          <TableHead className="w-[140px]">Route</TableHead>
          <TableHead className="w-[120px]">Aircraft</TableHead>
          <TableHead className="w-[140px]">Departure</TableHead>
          <TableHead className="w-[140px]">Arrival</TableHead>
          <TableHead className="w-[100px]">Status</TableHead>
          <TableHead className="w-[40px] text-right">{""}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {flights.map((flight) => (
          <FlightRow key={flight.id} flight={flight} />
        ))}
      </TableBody>
    </Table>
  );
}

function FlightRow({ flight }: { flight: FlightListItem }) {
  return (
    <TableRow className="cursor-pointer">
      <TableCell className="font-semibold">
        <Link
          href={`/dispatch/${flight.id}`}
          className="block hover:text-status-blue"
        >
          {flight.flight_number}
        </Link>
      </TableCell>
      <TableCell className="font-mono text-muted-foreground">
        {flight.origin} → {flight.destination}
      </TableCell>
      <TableCell className="font-mono">{flight.aircraft.tail_number}</TableCell>
      <TableCell className="font-mono text-muted-foreground">
        {formatDate(flight.scheduled_departure_at, {
          dateStyle: "short",
          timeStyle: "short",
        })}
      </TableCell>
      <TableCell className="font-mono text-muted-foreground">
        {formatDate(flight.scheduled_arrival_at, {
          dateStyle: "short",
          timeStyle: "short",
        })}
      </TableCell>
      <TableCell>
        <StatusBadge status={flight.status} />
      </TableCell>
      <TableCell className="text-right">
        <Link
          href={`/dispatch/${flight.id}`}
          className="text-muted-foreground hover:text-status-blue"
          aria-label={`Open ${flight.flight_number}`}
        >
          →
        </Link>
      </TableCell>
    </TableRow>
  );
}
