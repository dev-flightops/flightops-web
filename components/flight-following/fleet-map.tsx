"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import L from "leaflet";
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip } from "react-leaflet";

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

/**
 * Live aircraft map. Renders one colored dot per aircraft at its
 * latest known position; click to see tail / altitude / heading.
 *
 * Refresh strategy: `router.refresh()` every 30 seconds re-runs the
 * parent server component, which re-fetches `/positions/latest` and
 * re-renders this component with fresh props. Keeps the JWT
 * server-side and avoids implementing a client-side API client.
 */
export function FleetMap({ positions }: { positions: PositionResponse[] }) {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [router]);

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
        <AircraftMarker key={p.aircraft.id} position={p} />
      ))}
    </MapContainer>
  );
}

function AircraftMarker({ position }: { position: PositionResponse }) {
  // Colored by source so the dispatcher can tell simulated demo data
  // from a real ADS-B/GPS feed at a glance. Simulated rows show in
  // muted yellow; real feeds in vibrant green.
  const colour = colourForSource(position.source);

  return (
    <CircleMarker
      center={[position.latitude, position.longitude]}
      radius={6}
      pathOptions={{
        color: colour,
        fillColor: colour,
        fillOpacity: 0.85,
        weight: 2,
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
