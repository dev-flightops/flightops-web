"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { parseRouteText, routeToParam } from "@/lib/route";

/**
 * Live Route textarea — M2-G-12.
 *
 * The textarea is locally controlled while the user types; on blur (or
 * Cmd/Ctrl-Enter) we commit the parsed list to the `?route=` search
 * param via `router.replace`, which re-runs the dispatch page server
 * component and re-fetches the Weather panel with the new ICAOs.
 *
 * Empty input clears the param, so Weather falls back to
 * [origin, destination] from the selected flight.
 */
export function RouteInput({ defaultText }: { defaultText: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [text, setText] = useState(defaultText);

  const commit = () => {
    const params = new URLSearchParams(searchParams.toString());
    const icaos = parseRouteText(text);
    if (icaos.length > 0) {
      params.set("route", routeToParam(icaos));
    } else {
      params.delete("route");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <textarea
      rows={6}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          commit();
          e.currentTarget.blur();
        }
      }}
      placeholder={"PAEE\nPAUN\nPAGM"}
      className="ff-input font-mono text-sm"
      aria-label="Route — one ICAO per line"
    />
  );
}
