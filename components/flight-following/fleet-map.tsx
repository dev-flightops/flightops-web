"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import L from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
} from "react-leaflet";

import { getFlightTrackAction } from "@/app/(app)/flight-following/actions";
import { Spinner } from "@/components/ui/spinner";
import type { PositionResponse } from "@/lib/api/types";

import "leaflet/dist/leaflet.css";

// Leaflet ships PNG marker icons that 404 under Next.js's static
// asset pipeline. We don't use the default markers (we use
// CircleMarker instead — cleaner for aircraft + scales with zoom),
// but Leaflet still references them at startup. Stub the path so the
// browser doesn't fire 4 console-error 404s on first render.
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAeImBZsAAAAASUVORK5CYII=",
  iconRetinaUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAeImBZsAAAAASUVORK5CYII=",
  shadowUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAeImBZsAAAAASUVORK5CYII=",
});

// Centered on Anchorage with a zoom that covers the Aleutians + the
// Yukon-Kuskokwim delta — captures the bulk of the Peregrine demo
// tenant's operating area. Future M3 work can persist the user's
// preferred center/zoom in localStorage.
const DEFAULT_CENTER: [number, number] = [62.0, -155.0];
const DEFAULT_ZOOM = 5;
const REFRESH_INTERVAL_MS = 30_000;

/** Visible-track state lives here so the polyline survives the 30 s
 *  position refresh (parent's positions[] prop changes don't reset
 *  the selection). */
interface TrackState {
  flightId: string;
  positions: PositionResponse[] | null;  // null = loading
  error: string | null;
}

/**
 * Live aircraft map. Renders one colored dot per aircraft at its
 * latest known position; click to see tail / altitude / heading.
 *
 * M2-G-9: clicking an aircraft that's currently flying (has a non-null
 * `flight_id` on its latest fix) fetches `/flights/{id}/track` and
 * draws the path as a blue polyline with start/end markers. Click the
 * polyline (or the Clear track button in the popup) to remove it.
 *
 * Refresh strategy: `router.refresh()` every 30 seconds re-runs the
 * parent server component, which re-fetches `/positions/latest` and
 * re-renders this component with fresh props. Keeps the JWT
 * server-side and avoids implementing a client-side API client.
 */
export function FleetMap({ positions }: { positions: PositionResponse[] }) {
  const router = useRouter();
  const [track, setTrack] = useState<TrackState | null>(null);
  const [isLoadingTrack, startTrackLoad] = useTransition();

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [router]);

  const showTrack = (flightId: string) => {
    // Optimistic: clear previous, mark new as loading.
    setTrack({ flightId, positions: null, error: null });
    startTrackLoad(async () => {
      const result = await getFlightTrackAction(flightId);
      setTrack(
        result.ok
          ? { flightId, positions: result.positions, error: null }
          : { flightId, positions: [], error: result.error },
      );
    });
  };

  const clearTrack = () => setTrack(null);

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {positions.map((p) => (
        <AircraftMarker
          key={p.aircraft.id}
          position={p}
          dimmed={track !== null && track.flightId !== p.flight_id}
          isTrackLoading={
            isLoadingTrack &&
            track !== null &&
            track.flightId === p.flight_id
          }
          onShowTrack={
            p.flight_id ? () => showTrack(p.flight_id!) : undefined
          }
          onClearTrack={
            track !== null && track.flightId === p.flight_id
              ? clearTrack
              : undefined
          }
        />
      ))}
      {track !== null && (
        <TrackOverlay track={track} />
      )}
    </MapContainer>
  );
}

function TrackOverlay({ track }: { track: TrackState }) {
  if (track.positions === null) return null;  // still loading; no polyline yet
  if (track.positions.length === 0) return null;
  // Need at least 2 points to draw a line. A single-fix flight just
  // shows the existing aircraft marker — no polyline.
  if (track.positions.length < 2) return null;

  const path: [number, number][] = track.positions.map((p) => [
    p.latitude,
    p.longitude,
  ]);
  const start = track.positions[0];
  const end = track.positions[track.positions.length - 1];

  return (
    <>
      <Polyline
        positions={path}
        pathOptions={{
          color: "#3b82f6",  // status-blue
          weight: 3,
          opacity: 0.9,
        }}
      />
      {/* Start of track — small ring to mark departure */}
      <CircleMarker
        center={[start.latitude, start.longitude]}
        radius={5}
        pathOptions={{
          color: "#3b82f6",
          fillColor: "#ffffff",
          fillOpacity: 1,
          weight: 2,
        }}
      >
        <Tooltip>
          <span className="font-mono text-xs">
            Departed · {start.aircraft.tail_number}
          </span>
        </Tooltip>
      </CircleMarker>
      {/* End of track — solid dot to mark current/last position */}
      <CircleMarker
        center={[end.latitude, end.longitude]}
        radius={5}
        pathOptions={{
          color: "#3b82f6",
          fillColor: "#3b82f6",
          fillOpacity: 1,
          weight: 2,
        }}
      >
        <Tooltip>
          <span className="font-mono text-xs">
            Latest · {end.aircraft.tail_number}
          </span>
        </Tooltip>
      </CircleMarker>
    </>
  );
}

function AircraftMarker({
  position,
  dimmed,
  isTrackLoading,
  onShowTrack,
  onClearTrack,
}: {
  position: PositionResponse;
  dimmed: boolean;
  isTrackLoading: boolean;
  /** Provided when the aircraft has a flight_id; click triggers track load. */
  onShowTrack?: () => void;
  /** Provided when THIS aircraft's track is currently shown; click clears. */
  onClearTrack?: () => void;
}) {
  // Colored by source so the dispatcher can tell simulated demo data
  // from a real ADS-B/GPS feed at a glance.
  const colour = colourForSource(position.source);

  return (
    <CircleMarker
      center={[position.latitude, position.longitude]}
      radius={6}
      pathOptions={{
        color: colour,
        fillColor: colour,
        fillOpacity: dimmed ? 0.25 : 0.85,
        weight: 2,
        opacity: dimmed ? 0.4 : 1,
      }}
    >
      <Tooltip direction="top" offset={[0, -8]}>
        <span className="font-mono font-semibold">
          {position.aircraft.tail_number}
        </span>
      </Tooltip>
      <Popup>
        <div className="text-xs">
          <p className="m-0 font-mono text-sm font-bold">
            {position.aircraft.tail_number}
          </p>
          <p className="m-0 text-muted-foreground">
            {position.aircraft.model}
          </p>
          <dl className="m-0 mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
            <dt>Altitude</dt>
            <dd className="m-0 font-mono">
              {position.altitude_ft !== null
                ? `${position.altitude_ft.toLocaleString()} ft`
                : "—"}
            </dd>
            <dt>Speed</dt>
            <dd className="m-0 font-mono">
              {position.groundspeed_kt !== null
                ? `${position.groundspeed_kt} kt`
                : "—"}
            </dd>
            <dt>Heading</dt>
            <dd className="m-0 font-mono">
              {position.heading_deg !== null
                ? `${String(position.heading_deg).padStart(3, "0")}°`
                : "—"}
            </dd>
            <dt>Source</dt>
            <dd className="m-0 font-mono uppercase">{position.source}</dd>
          </dl>

          {/* Track controls — only render when the aircraft has a
              flight_id (otherwise there's nothing to fetch). */}
          {onShowTrack && (
            <button
              type="button"
              onClick={onShowTrack}
              disabled={isTrackLoading}
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-status-blue/40 bg-status-blue/10 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-status-blue hover:bg-status-blue/20 disabled:opacity-50"
            >
              {isTrackLoading && <Spinner size="xs" />}
              {isTrackLoading ? "Loading track…" : "Show flight track"}
            </button>
          )}
          {onClearTrack && (
            <button
              type="button"
              onClick={onClearTrack}
              className="mt-3 w-full rounded-md border border-border bg-muted/30 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground hover:bg-muted/50"
            >
              Clear track
            </button>
          )}
          {!onShowTrack && !onClearTrack && (
            <p className="m-0 mt-3 text-[0.65rem] italic text-muted-foreground/70">
              No flight plan filed — no track to show.
            </p>
          )}
        </div>
      </Popup>
    </CircleMarker>
  );
}

function colourForSource(source: PositionResponse["source"]): string {
  switch (source) {
    case "adsb":
      return "#22c55e"; // green — real authoritative feed
    case "gps":
      return "#3b82f6"; // blue — onboard GPS uplink
    case "manual":
      return "#f59e0b"; // amber — manual radio relay
    case "simulated":
      return "#a3a3a3"; // grey — demo data
  }
}
