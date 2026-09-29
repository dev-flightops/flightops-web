"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

import { nextDispatchQuery, settleDispatchQuery } from "./dispatch-query";

/**
 * Returns `next(change)`, which gives the query string to navigate to
 * for a change to the packet's URL state. Use it instead of copying
 * useSearchParams(): see dispatch-query.ts for why.
 *
 * `change` reads the current values from the params it is handed, not
 * from props. Props are the last render too, so a set rebuilt from
 * them drops a tick still loading just the same.
 */
export function useDispatchQuery(): (
  change: (params: URLSearchParams) => void,
) => string {
  const shown = useSearchParams()?.toString() ?? "";
  // Read at call time: a handler that awaits (the PIC picker assigns
  // crew first) may run after the page has moved on.
  const shownRef = useRef(shown);
  useEffect(() => {
    shownRef.current = shown;
    settleDispatchQuery(shown);
  }, [shown]);
  return useCallback(
    (change: (params: URLSearchParams) => void) =>
      nextDispatchQuery(shownRef.current, change),
    [],
  );
}
