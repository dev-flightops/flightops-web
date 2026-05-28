import { notFound } from "next/navigation";
import { Package, Plane, Users } from "lucide-react";

import { Breadcrumb } from "@/components/ui/breadcrumb";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DownloadPdfButton } from "@/components/dispatch/download-pdf-button";
import { ReleaseButton } from "@/components/dispatch/release-button";
import { ReleasedFooter } from "@/components/dispatch/released-footer";
import { StatusBadge } from "@/components/dispatch/status-badge";
import { ApiError } from "@/lib/api/client";
import { getFlight } from "@/lib/api/ops";
import { formatDate } from "@/lib/utils";

interface Props {
  params: Promise<{ flightId: string }>;
}

export default async function FlightDetailPage({ params }: Props) {
  const { flightId } = await params;

  try {
    const flight = await getFlight(flightId);
    const payloadHeadroom =
      flight.max_payload_lbs !== null
        ? flight.max_payload_lbs - flight.cargo_lbs
        : null;

    return (
      <div className="container py-6">
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <Breadcrumb
              icon={<Plane className="h-3.5 w-3.5" />}
              segments={[
                { label: "Operations" },
                { label: "Dispatch", href: "/dispatch" },
                { label: flight.flight_number },
              ]}
            />
            <h1 className="mt-1 text-xl font-bold tracking-tight">
              {flight.flight_number}
            </h1>
            <p className="mt-0.5 font-mono text-sm text-muted-foreground">
              {flight.origin} → {flight.destination}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={flight.status} className="text-sm" />
            {flight.status === "scheduled" && (
              <ReleaseButton
                flightId={flight.id}
                flightNumber={flight.flight_number}
                origin={flight.origin}
                destination={flight.destination}
              />
            )}
          </div>
        </header>

        {flight.status === "released" &&
          flight.released_at &&
          flight.released_by && (
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <ReleasedFooter
                releasedAt={flight.released_at}
                releasedBy={flight.released_by}
              />
              <DownloadPdfButton flightId={flight.id} />
            </div>
          )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Schedule</CardTitle>
              <CardDescription>All times in UTC</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <Row label="Departure" value={formatDate(flight.scheduled_departure_at)} />
              <Row label="Arrival" value={formatDate(flight.scheduled_arrival_at)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Aircraft</CardTitle>
              <CardDescription>{flight.aircraft.model}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <Row
                icon={<Plane className="h-4 w-4 text-muted-foreground" />}
                label="Tail number"
                value={flight.aircraft.tail_number}
              />
              <Row label="Seats" value={String(flight.aircraft.seats)} />
              {flight.max_payload_lbs !== null && (
                <Row
                  label="Max payload"
                  value={`${flight.max_payload_lbs.toLocaleString()} lbs`}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Load</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <Row
                icon={<Users className="h-4 w-4 text-muted-foreground" />}
                label="Passengers"
                value={`${flight.pax_count} / ${flight.aircraft.seats}`}
              />
              <Row
                icon={<Package className="h-4 w-4 text-muted-foreground" />}
                label="Cargo"
                value={`${flight.cargo_lbs.toLocaleString()} lbs`}
              />
              {payloadHeadroom !== null && (
                <Row
                  label="Payload headroom"
                  value={`${payloadHeadroom.toLocaleString()} lbs`}
                />
              )}
            </CardContent>
          </Card>

          {flight.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{flight.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }
}

function Row({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/40 pb-2 last:border-0 last:pb-0">
      <span className="flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
