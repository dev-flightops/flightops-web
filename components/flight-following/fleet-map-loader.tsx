"use client";

import dynamic from "next/dynamic";

import type { PositionResponse } from "@/lib/api/types";

// react-leaflet touches `window` at import time (it instantiates
// Leaflet's L global), so SSR has to be off — Next would crash
// during the server render otherwise. Dynamic import with
// ssr:false defers the bundle to client-side only.
//
// The placeholder while the chunk loads is a styled box so the
// layout doesn't reflow when the map mounts. Same height as the
// real map.
const FleetMapInner = dynamic(
  () => import("./fleet-map").then((mod) => mod.FleetMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center rounded-md border border-border bg-card/40 text-xs text-muted-foreground">
        Loading map…
      </div>
    ),
  },
);

export function FleetMapLoader({
  positions,
}: {
  positions: PositionResponse[];
}) {
  return <FleetMapInner positions={positions} />;
}
