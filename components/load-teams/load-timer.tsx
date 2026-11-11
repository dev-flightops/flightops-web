"use client";

import { useEffect, useState } from "react";

import { type LoadTiming, loadTiming } from "@/lib/load-teams/load-timing";

/**
 * The ramp timer (LOG-43), kept current while the page is open. The first
 * paint uses the server's time, so it matches what the server sent; then
 * the browser's clock, every half minute.
 */
export function LoadTimer({
  departsAt,
  startedAt,
  completedAt,
  renderedAt,
}: {
  departsAt: string;
  startedAt: string | null;
  completedAt: string | null;
  renderedAt: number;
}) {
  const [now, setNow] = useState(renderedAt);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const { text, late }: LoadTiming = loadTiming(
    {
      load_started_at: startedAt,
      load_completed_at: completedAt,
      flight: { scheduled_departure_at: departsAt },
    },
    now,
  );
  return <span className={late ? "text-status-red" : undefined}>{text}</span>;
}
