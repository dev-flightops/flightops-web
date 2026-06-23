import { permanentRedirect } from "next/navigation";

/**
 * Bookmark-safety redirect — the elog landing moved from /flight-log
 * to /flight-crew/elog as part of the Spec 4 grouping of flight-crew
 * surfaces (preflight + elog + flight history) under one parent
 * route. Use `permanentRedirect` so browsers cache the new location.
 */
export default function FlightLogIndexRedirect() {
  permanentRedirect("/flight-crew/elog");
}
