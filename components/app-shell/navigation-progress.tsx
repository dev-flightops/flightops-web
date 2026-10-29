"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  NAVIGATION_START,
  opensAnotherPage,
  type NavigationStart,
} from "@/lib/navigation-progress";

/** A navigation quicker than this shows nothing, so the bar doesn't flash. */
export const SHOW_AFTER_MS = 150;
/** Given up on after this: a navigation Next abandoned for another one. */
export const GIVE_UP_MS = 20_000;

/**
 * A thin bar along the top of the window while a page loads (#142).
 *
 * Greg, 29 Oct: "some pages takes some for loading, in that case show
 * loading animation". A page that changes shows the app's spinner in
 * its place ((app)/loading.tsx), but a change within a page keeps the old
 * one on screen until the new one is ready: a date, a filter, a picked
 * flight. The bar shows for those too, and for the moment before the
 * spinner arrives. It goes when the new address is in place.
 *
 * With reduced motion it stands still at full width.
 */
export function NavigationProgress() {
  const address = `${usePathname()}?${useSearchParams().toString()}`;
  const [visible, setVisible] = useState(false);
  const timers = useRef<{ show?: number; giveUp?: number }>({});
  const shown = useRef(address);

  useEffect(() => {
    const current = timers.current;
    const stop = () => {
      window.clearTimeout(current.show);
      window.clearTimeout(current.giveUp);
      setVisible(false);
    };
    const start = ({ url }: NavigationStart) => {
      if (!opensAnotherPage(url, window.location.href)) return;
      window.clearTimeout(current.show);
      window.clearTimeout(current.giveUp);
      current.show = window.setTimeout(() => setVisible(true), SHOW_AFTER_MS);
      current.giveUp = window.setTimeout(stop, GIVE_UP_MS);
    };
    const onStart = (event: Event) => start((event as CustomEvent<NavigationStart>).detail);
    window.addEventListener(NAVIGATION_START, onStart);
    // One that started before the bar was listening, if it hasn't arrived.
    if (window.__flightopsNavigation) start(window.__flightopsNavigation);
    return () => {
      window.removeEventListener(NAVIGATION_START, onStart);
      stop();
    };
  }, []);

  // A new address in place: the navigation has arrived.
  useEffect(() => {
    if (shown.current === address) return;
    shown.current = address;
    window.__flightopsNavigation = undefined;
    window.clearTimeout(timers.current.show);
    window.clearTimeout(timers.current.giveUp);
    setVisible(false);
  }, [address]);

  if (!visible) return null;
  return (
    <div
      role="progressbar"
      aria-label="Loading page"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden"
    >
      <div className="h-full w-1/3 bg-primary motion-safe:animate-ff-sweep motion-reduce:w-full" />
    </div>
  );
}
