"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { X } from "lucide-react";

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
 *
 * M2-G-16: small "× clear" button surfaces in the top-right of the
 * textarea when it has content. Click clears the local state AND the
 * `?route=` URL param in one step — fixes the case where the user has
 * to manually select-all-and-delete-and-blur to reset the routing.
 */
export function RouteInput({ defaultText }: { defaultText: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [text, setText] = useState(defaultText);

  const commit = (override?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const icaos = parseRouteText(override ?? text);
    if (icaos.length > 0) {
      params.set("route", routeToParam(icaos));
    } else {
      params.delete("route");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const clear = () => {
    setText("");
    // Pass empty explicitly — React's setState is async and the next
    // commit() call would otherwise still see the stale `text`.
    commit("");
  };

  return (
    <div className="relative">
      <textarea
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => commit()}
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
      {text.length > 0 && (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear route"
          title="Clear route — Weather will fall back to the flight's origin + destination"
          className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/70 transition hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
