/**
 * Client instrumentation: Next runs this file before the app hydrates.
 *
 * It tells the navigation progress bar when a client navigation starts
 * (#142). Next calls `onRouterTransitionStart` for every one, from a
 * <Link>, the router or the browser's back and forward; the bar is
 * components/app-shell/navigation-progress.tsx.
 */

import { NAVIGATION_START, type NavigationStart } from "@/lib/navigation-progress";

export function onRouterTransitionStart(
  url: string,
  navigationType: NavigationStart["navigationType"],
) {
  const detail = { url, navigationType };
  window.__flightopsNavigation = detail;
  window.dispatchEvent(new CustomEvent<NavigationStart>(NAVIGATION_START, { detail }));
}
