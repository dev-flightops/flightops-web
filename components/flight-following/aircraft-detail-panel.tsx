"use client";

import Link from "next/link";
import { X } from "lucide-react";

import { Spinner } from "@/components/ui/spinner";
import type { PositionResponse } from "@/lib/api/types";
import { formatZulu } from "@/lib/format/flight-time";

/**
 * Slide-in side panel that shows when an aircraft is clicked on the
 * map (M2-G-13). Replaces the in-marker Leaflet popup used in
 * M2-G-8/9.
 *
 * Why a panel vs. a popup?
 * Dispatchers tracking multiple aircraft kept losing context as the
 * popup moved with the map and obscured nearby markers. The panel
 * docks to the right edge, doesn't move when the map pans, and lets
 * the user click other markers without losing the panel target.
 *
 * Content mirrors the legacy `templates/flight_following/board.html`
 * `#ac-panel`: tail + type header, source pill, key flight detail
 * rows, "Open Dispatch Packet" CTA when the position has a
 * `flight_id`, and the M2-G-9 Show / Clear flight track controls.
 */
export interface AircraftDetailPanelProps {
  position: PositionResponse;
  /** True iff THIS aircraft's track is currently shown on the map. */
  isTrackVisible: boolean;
  /** True iff the track fetch is in flight (any aircraft). */
  isTrackLoading: boolean;
  onClose: () => void;
  onShowTrack: () => void;
  onClearTrack: () => void;
}

export function AircraftDetailPanel({
  position,
  isTrackVisible,
  isTrackLoading,
  onClose,
  onShowTrack,
  onClearTrack,
}: AircraftDetailPanelProps) {
  const hasFlight = position.flight_id !== null;

  return (
    <aside
      role="dialog"
      aria-label={`Aircraft details for ${position.aircraft.tail_number}`}
      className="absolute right-3 top-3 bottom-3 z-[1000] flex w-[280px] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-lg"
    >
      <header className="flex items-start justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
        <div className="min-w-0">
          <div className="font-mono text-sm font-bold text-foreground">
            {position.aircraft.tail_number}
          </div>
          <div className="truncate text-[0.65rem] text-muted-foreground">
            {position.aircraft.model}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close aircraft details"
          className="rounded p-1 text-muted-foreground hover:bg-border/40 hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-3 text-xs">
        <SourcePill source={position.source} />

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
          <DetailRow
            label="Altitude"
            value={
              position.altitude_ft !== null
                ? `${position.altitude_ft.toLocaleString()} ft`
                : "—"
            }
          />
          <DetailRow
            label="Speed"
            value={
              position.groundspeed_kt !== null
                ? `${position.groundspeed_kt} kt`
                : "—"
            }
          />
          <DetailRow
            label="Heading"
            value={
              position.heading_deg !== null
                ? `${String(position.heading_deg).padStart(3, "0")}°`
                : "—"
            }
          />
          <DetailRow
            label="Position"
            value={`${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)}`}
          />
          <DetailRow
            label="Last fix"
            value={`${formatZulu(position.reported_at)}`}
          />
        </dl>

        {hasFlight ? (
          <Link
            href={`/dispatch?flight=${position.flight_id}`}
            className="rounded-md bg-status-blue px-3 py-2 text-center text-[0.7rem] font-semibold text-white hover:brightness-110"
          >
            Open Dispatch Packet →
          </Link>
        ) : (
          <p className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-2 text-center text-[0.65rem] italic text-muted-foreground/70">
            No flight plan filed for this aircraft.
          </p>
        )}

        {hasFlight && !isTrackVisible && (
          <button
            type="button"
            onClick={onShowTrack}
            disabled={isTrackLoading}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-status-blue/40 bg-status-blue/10 px-2 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-status-blue hover:bg-status-blue/20 disabled:opacity-50"
          >
            {isTrackLoading && <Spinner size="xs" />}
            {isTrackLoading ? "Loading track…" : "Show flight track"}
          </button>
        )}
        {isTrackVisible && (
          <button
            type="button"
            onClick={onClearTrack}
            className="w-full rounded-md border border-border bg-muted/30 px-2 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground hover:bg-muted/50"
          >
            Clear track
          </button>
        )}
      </div>
    </aside>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="m-0 text-right font-mono text-foreground">{value}</dd>
    </>
  );
}

function SourcePill({ source }: { source: PositionResponse["source"] }) {
  const palette: Record<PositionResponse["source"], string> = {
    adsb: "bg-status-green/15 text-status-green",
    gps: "bg-status-blue/15 text-status-blue",
    manual: "bg-status-yellow/15 text-status-yellow",
    simulated: "bg-muted/50 text-muted-foreground",
  };
  return (
    <span
      className={`inline-flex w-fit items-center rounded px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] ${palette[source]}`}
    >
      {source}
    </span>
  );
}
