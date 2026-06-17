import { Sparkles } from "lucide-react";

import { DownloadPdfButton } from "@/components/dispatch/download-pdf-button";
import { EditFlightDialog } from "@/components/dispatch/edit-flight-dialog";
import { ReleaseButton } from "@/components/dispatch/release-button";
import { ReleasedFooter } from "@/components/dispatch/released-footer";
import { StatusBadge } from "@/components/dispatch/status-badge";
import type { AircraftListItem, FlightDetail } from "@/lib/api/types";

import { GeneratePdfButton } from "./generate-pdf-button";
import { RefreshWeatherButton } from "./refresh-weather-button";
import { SectionPanel } from "./section-panel";

/**
 * Right column of the dispatch packet form — flight-state actions on top,
 * briefing-actions row below, then briefing-data + dispatcher notes panels.
 *
 * As of M2-G-15 this column owns ALL flight-state actions (Edit, Release,
 * Generate PDF) in addition to the existing briefing actions (Refresh
 * Weather, AI Review, Generate PDF). Before M2-G-15 those lived on a
 * separate `/dispatch/[flightId]` detail page — that page is now a redirect.
 *
 * Layout matches the legacy peregrineflight.com style — flat button rows
 * at the top of the column, no labeled SectionPanel wrappers around the
 * actions. Labels would add visual weight legacy didn't have.
 */
export function RightColumn({
  flight,
  aircraft = [],
}: {
  flight?: FlightDetail | null;
  /** Aircraft list for the Edit dialog's tail-swap selector. Only needed
   *  when a scheduled flight is selected; an empty array is fine
   *  otherwise (the selector hides itself when the list is empty). */
  aircraft?: AircraftListItem[];
}) {
  return (
    <div className="space-y-5">
      {flight && (
        <div id="release-actions">
          <FlightActionsRow flight={flight} aircraft={aircraft} />
        </div>
      )}

      <SectionPanel title={null}>
        <div className="flex flex-wrap gap-3">
          <RefreshWeatherButton flightSelected={!!flight} />

          <button
            type="button"
            disabled
            title="AI Review · Coming in M4"
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-status-purple/40 bg-transparent px-4 py-2 text-xs font-semibold text-status-purple opacity-60"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            AI Review
          </button>

          <GeneratePdfButton flight={flight ?? null} />
        </div>
      </SectionPanel>

      <SectionPanel title="Briefing data">
        <p className="text-xs text-muted-foreground">
          When the packet is refreshed, this panel fills with weather summary,
          weight &amp; balance, performance, and risk score cards. Empty until
          the supporting services ship.
        </p>
      </SectionPanel>

      <SectionPanel title="Dispatcher Notes">
        <textarea
          rows={4}
          disabled
          placeholder="Internal notes for this packet — visible to dispatch + ops, not on the released PDF."
          className="ff-input text-sm"
        />
      </SectionPanel>
    </div>
  );
}

/**
 * Flat row of flight-state actions, no labeled wrapper. Status badge is
 * inline with the buttons so you can see at a glance whether the flight
 * is scheduled / released / cancelled / completed.
 *
 *   scheduled  → [status pill] [Edit] [Release dispatch]
 *   released   → [status pill] + ReleasedFooter strip + [Download PDF]
 *   cancelled/
 *   completed  → [status pill] + small "no actions available" hint
 */
function FlightActionsRow({
  flight,
  aircraft,
}: {
  flight: FlightDetail;
  aircraft: AircraftListItem[];
}) {
  if (flight.status === "scheduled") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={flight.status} />
        <EditFlightDialog flight={flight} aircraft={aircraft} />
        <ReleaseButton
          flightId={flight.id}
          flightNumber={flight.flight_number}
          origin={flight.origin}
          destination={flight.destination}
        />
      </div>
    );
  }

  if (
    flight.status === "released" &&
    flight.released_at &&
    flight.released_by
  ) {
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <StatusBadge status={flight.status} />
          <ReleasedFooter
            releasedAt={flight.released_at}
            releasedBy={flight.released_by}
          />
        </div>
        <DownloadPdfButton flightId={flight.id} />
      </div>
    );
  }

  // cancelled / completed
  return (
    <div className="flex flex-wrap items-center gap-3">
      <StatusBadge status={flight.status} />
      <span className="text-xs text-muted-foreground">
        This flight is {flight.status} — no actions available.
      </span>
    </div>
  );
}
