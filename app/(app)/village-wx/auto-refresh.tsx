"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Tiny client island that re-fetches the server component every 5
 * minutes. The board's stale tinting (>2hr yellow, >4hr red) is age-
 * based, so even with no new reports the colors evolve over time —
 * the refresh keeps the display in sync.
 *
 * Page-level `export const revalidate = 300` would also work, but that
 * caches the server response and the user wouldn't see new reports
 * filed by teammates between refreshes. router.refresh() bypasses the
 * cache, costing one round-trip every 5 min — fine for a low-traffic
 * dispatch surface.
 */
const REFRESH_MS = 5 * 60 * 1000;

export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(id);
  }, [router]);
  return null;
}
