"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Refresh, and the timezone handshake behind it.
 *
 * A server component cannot read the browser's zone, so the day the
 * brief covers has to come from somewhere. The service defaults to
 * UTC when it is not told — which is the wrong day for nine hours of
 * every twenty-four in Anchorage, and the whole reason the endpoint
 * takes a zone at all.
 *
 * The nav links are static and cannot carry it, so this puts the
 * browser's zone into the URL on first paint and lets the page render
 * again against the right day. Anyone whose local day already matches
 * UTC's sees nothing happen; anyone west of Greenwich in the evening
 * sees the brief correct itself once rather than quietly showing
 * yesterday all night.
 *
 * The URL is where it goes rather than a cookie, so a shared or
 * bookmarked link keeps meaning the same day it did when it was sent.
 */
export function BriefControls() {
  const router = useRouter();
  const params = useSearchParams();
  const [refreshing, setRefreshing] = useState(false);
  const tz = params.get("tz");

  useEffect(() => {
    // Only fill it in when it is missing. Overwriting a zone that is
    // already in the URL would quietly retarget a link somebody sent
    // deliberately — "here is this morning, Anchorage time" would
    // become the reader's morning instead.
    if (tz) return;
    const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!local) return;
    const next = new URLSearchParams(params.toString());
    next.set("tz", local);
    // replace, not push — the UTC-rendered version is not a page
    // anyone should be able to navigate back to.
    router.replace(`?${next.toString()}`, { scroll: false });
  }, [tz, params, router]);

  return (
    <button
      type="button"
      onClick={() => {
        setRefreshing(true);
        router.refresh();
        // The refresh resolves on the server; there is no promise to
        // await, so the button re-enables on a short timer rather
        // than pretending to know when the data landed.
        setTimeout(() => setRefreshing(false), 1200);
      }}
      disabled={refreshing}
      className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
    >
      {refreshing ? "Refreshing…" : "Refresh"}
    </button>
  );
}
