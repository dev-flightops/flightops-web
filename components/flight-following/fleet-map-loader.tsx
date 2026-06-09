"use client";

import dynamic from "next/dynamic";

import { LoadingPanel } from "@/components/ui/spinner";
import type { PositionResponse } from "@/lib/api/types";

// react-leaflet touches `window` at import time (it instantiates
// Leaflet's L global), so SSR has to be off — Next would crash
// during the server render otherwise. Dynamic import with
// ssr:false defers the bundle to client-side only.
//
// The placeholder while the chunk loads is a centred spinner so the
// layout doesn't reflow when the map mounts.
const FleetMapInner = dynamic(
  () => import("./fleet-map").then((mod) => mod.FleetMap),
  {
    ssr: false,
    loading: () => <LoadingPanel label="Loading map…" />,
  },
);

export function FleetMapLoader({
  positions,
}: {
  positions: PositionResponse[];
}) {
  return <FleetMapInner positions={positions} />;
}
