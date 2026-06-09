"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import L from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
} from "react-leaflet";

import { getFlightTrackAction } from "@/app/(app)/flight-following/actions";
import type { PositionResponse } from "@/lib/api/types";

import { AircraftDetailPanel } from "./aircraft-detail-panel";
import { SimBanner } from "./sim-banner";

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
 * latest known position. Click a marker → side panel slides in with
 * full details + Open Dispatch Packet CTA (M2-G-13).
 *
 * Layered behaviors:
 *   M2-G-8  — base map + per-aircraft markers + Tooltip on hover
 *   M2-G-9  — Show flight track → polyline of /flights/{id}/track
 *   M2-G-13 — sim-mode banner (when any source=simulated) + the
 *             slide-in AircraftDetailPanel that replaces the Leaflet
 *             Popup used in earlier stories
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
  /** Currently-selected aircraft.id, or null when the panel is closed. */
  const [selectedAircraftId, setSelectedAircraftId] = useState<string | null>(
    null,
  );

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
  const closePanel = () => setSelectedAircraftId(null);

  // Re-derive the selected position each render from props — the
  // 30s refresh updates altitude/speed live behind the panel without
  // needing to reach into the panel's state.
  const selectedPosition =
    selectedAircraftId !== null
      ? positions.find((p) => p.aircraft.id === selectedAircraftId) ?? null
      : null;

  return (
    <div className="relative h-full w-full">
      <SimBanner positions={positions} />
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
            isSelected={p.aircraft.id === selectedAircraftId}
            onSelect={() => setSelectedAircraftId(p.aircraft.id)}
          />
        ))}
        {track !== null && <TrackOverlay track={track} />}
      </MapContainer>
      {selectedPosition !== null && (
        <AircraftDetailPanel
          position={selectedPosition}
          isTrackVisible={
            track !== null && track.flightId === selectedPosition.flight_id
          }
          isTrackLoading={
            isLoadingTrack &&
            track !== null &&
            track.flightId === selectedPosition.flight_id
          }
          onClose={closePanel}
          onShowTrack={() =>
            selectedPosition.flight_id !== null &&
            showTrack(selectedPosition.flight_id)
          }
          onClearTrack={clearTrack}
        />
      )}
    </div>
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
  isSelected,
  onSelect,
}: {
  position: PositionResponse;
  dimmed: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  // Colored by source so the dispatcher can tell simulated demo data
  // from a real ADS-B/GPS feed at a glance.
  const colour = colourForSource(position.source);

  return (
    <CircleMarker
      center={[position.latitude, position.longitude]}
      radius={isSelected ? 8 : 6}
      pathOptions={{
        color: colour,
        fillColor: colour,
        fillOpacity: dimmed ? 0.25 : 0.85,
        weight: isSelected ? 3 : 2,
        opacity: dimmed ? 0.4 : 1,
      }}
      eventHandlers={{ click: onSelect }}
    >
      <Tooltip direction="top" offset={[0, -8]}>
        <span className="font-mono font-semibold">
          {position.aircraft.tail_number}
        </span>
      </Tooltip>
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
