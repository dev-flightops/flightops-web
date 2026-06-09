"use client";

import { useEffect, useState } from "react";

/**
 * Live UTC ("Zulu") clock for the Flight Following page subtitle.
 *
 * Updates once per second; format matches the legacy board.html:
 * "HH:MMz" (lowercase z, no seconds). Dispatchers reference Z-time
 * for every ETD/ETA decision so this needs to be permanently visible.
 *
 * Client component because new Date() would mismatch between server
 * render and first hydration. Initial paint shows an em-dash to
 * avoid layout shift.
 */
export function AutoClock() {
  const [zuluTime, setZuluTime] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const hh = String(now.getUTCHours()).padStart(2, "0");
      const mm = String(now.getUTCMinutes()).padStart(2, "0");
      setZuluTime(`${hh}:${mm}z`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span suppressHydrationWarning className="tabular-nums">
      {zuluTime ?? "—"}
    </span>
  );
}
