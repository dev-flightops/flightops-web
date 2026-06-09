/**
 * Shared source-colour legend rendered under the map.
 * Extracted from page.tsx during M2-G-10 so the same legend can sit
 * under the map in either Map or Split mode without copy-pasting copy.
 */
export function SourceLegend() {
  return (
    <p className="mt-3 text-[0.65rem] text-muted-foreground/70">
      Source colour: <span className="text-status-green">green</span> = ADS-B
      · <span className="text-status-blue">blue</span> = GPS uplink ·{" "}
      <span className="text-status-yellow">amber</span> = manual radio relay ·{" "}
      <span className="text-muted-foreground">grey</span> = simulated (demo
      data, M3 ADS-B adapter replaces).
    </p>
  );
}
