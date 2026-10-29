/**
 * The navigation progress bar's plumbing (#142). Next calls
 * `onRouterTransitionStart` (instrumentation-client.ts) when a client
 * navigation starts, from a <Link> or the router, and it passes the word
 * on as this window event. The bar (components/app-shell/
 * navigation-progress.tsx) listens for it and goes when the new address
 * is in place.
 */

export const NAVIGATION_START = "flightops:navigation-start";

export interface NavigationStart {
  url: string;
  navigationType: "push" | "replace" | "traverse";
}

declare global {
  interface Window {
    /** The latest navigation started, for a bar that wasn't listening yet:
     *  a click as the page loaded can start one before the bar hydrates. */
    __flightopsNavigation?: NavigationStart;
  }
}

/**
 * Whether a navigation to `url` from `current` loads anything to wait
 * for: another path, or other search parameters (a date, a filter, a
 * picked flight). A change of hash alone, or the same address, does not.
 */
export function opensAnotherPage(url: string, current: string): boolean {
  try {
    const from = new URL(current);
    const to = new URL(url, from);
    return (
      to.origin === from.origin &&
      (to.pathname !== from.pathname || to.search !== from.search)
    );
  } catch {
    return false;
  }
}
